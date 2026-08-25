"use server";

// カード登録の Server Action。
// フォーム送信 → サーバーでバリデーション → DB 保存 → 利益プレビューを返す。
// エラーはユーザーに分かりやすい文言で返し、詳細はログに残す（クラッシュさせない）。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Card, Settings } from "@/generated/prisma/client";
import { parseCardForm } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { computeCardProfit, buildSoldContext } from "@/lib/cardProfit";
import { recordPriceHistory } from "@/lib/priceHistory";
import { nextPredictedSellUsd } from "@/lib/forecast";
import { nextSoldContext, parseSoldContext } from "@/lib/soldContext";
import { parseImportText } from "@/lib/csvImport";
import type { BuybackFormState } from "@/app/cards/buyback/buybackState";
import { logger } from "@/lib/logger";
import type { CardFormState } from "@/app/cards/formState";
import type { ImportFormState } from "@/app/cards/import/importState";

/**
 * カードを新規登録する。
 * @param _prev 直前の状態（useActionState から渡る。未使用）
 * @param formData 送信されたフォーム
 */
/**
 * 売却済になったカードに、その時点の手数料・為替を焼き付ける。
 *
 * 行を作ってから実施するのは、条件の組み立て（まとめ発送の按分など）が
 * 保存後の Card を必要とするため。一度入った値は上書きしない。
 */
async function pinSoldContext(card: Card, settings: Settings): Promise<Card> {
  const next = nextSoldContext({
    current: card.soldContext,
    nextStatus: card.status,
    feeBase: buildSoldContext(card, settings),
  });

  const currentIsSet = parseSoldContext(card.soldContext) !== null;
  // 売却済以外に戻ったら破棄する（また売るときの条件で取り直す）
  if (next === null) {
    return currentIsSet
      ? prisma.card.update({ where: { id: card.id }, data: { soldContext: Prisma.DbNull } })
      : card;
  }
  if (currentIsSet) return card;

  return prisma.card.update({ where: { id: card.id }, data: { soldContext: next } });
}

export async function createCard(
  _prev: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  // 1) バリデーション
  const parsed = parseCardForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "入力内容に誤りがあります。赤いメッセージをご確認ください。",
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    // 2) 保存
    const data = parsed.data;
    const card = await prisma.card.create({
      data: {
        name: data.name,
        cardNumber: data.cardNumber ?? null,
        setName: data.setName ?? null,
        rarity: data.rarity ?? null,
        language: data.language,
        condition: data.condition,
        imageUrl: data.imageUrl ?? null,
        purchasePriceJpy: data.purchasePriceJpy,
        supplier: data.supplier ?? null,
        domesticBuybackJpy: data.domesticBuybackJpy,
        purchasedAt: data.purchasedAt ?? null,
        stock: data.stock,
        sellPriceUsd: data.sellPriceUsd,
        shippingChargedUsd: data.shippingChargedUsd,
        fxRate: data.fxRate ?? null,
        shippingJpy: data.shippingJpy,
        gradedShippingJpy: data.gradedShippingJpy,
        weightGrams: data.weightGrams ?? null,
        psa10SellUsd: data.psa10SellUsd,
        psa9SellUsd: data.psa9SellUsd,
        psa10Prob: data.psa10Prob,
        gradingPlan: data.gradingPlan,
        predictedSellUsd: nextPredictedSellUsd({
          current: 0,
          previousSellUsd: 0, // 新規なので更新前の値は無い
          nextSellUsd: data.sellPriceUsd,
          nextStatus: data.status,
        }),
        status: data.status,
        soldPriceUsd: data.soldPriceUsd,
        soldAt: data.soldAt ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? null,
      },
    });

    // 3) 売却済で登録されたなら、その時点の条件を固定する
    const settings = await getSettings();
    const saved = await pinSoldContext(card, settings);

    // 4) 利益プレビューを計算（登録直後に判定を見せる）
    const profit = computeCardProfit(saved, settings);

    // 5) 価格履歴に記録（推移グラフ用）
    await recordPriceHistory(saved, settings);

    // 4) 一覧のキャッシュを更新
    revalidatePath("/");

    return {
      status: "success",
      message: `「${card.name}」を登録しました。`,
      created: {
        id: card.id,
        name: card.name,
        profitJpy: profit.profitJpy,
        profitRate: profit.profitRate,
        decisionLabel: profit.decisionLabel,
        score: profit.score,
      },
    };
  } catch (err) {
    logger.error("カード登録に失敗", err);
    return {
      status: "error",
      message:
        "保存中にエラーが発生しました。時間をおいて再度お試しください（詳細はサーバーログを確認）。",
    };
  }
}

/**
 * CSV/貼り付けテキストからカードを一括登録する。
 * 既定値（言語=日本語, 状態=素体, 在庫=1 等）で不足分を補う。
 */
export async function importCards(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const text = String(formData.get("text") ?? "");
  if (text.trim() === "") {
    return { status: "error", message: "取り込むテキストを入力してください。" };
  }

  const { cards, total, skipped } = parseImportText(text);
  if (cards.length === 0) {
    return {
      status: "error",
      message: `有効な行が見つかりませんでした（${total} 行を解釈、${skipped} 行スキップ）。1列目にカード名が必要です。`,
    };
  }

  try {
    const settings = await getSettings();
    const fx = settings.defaultFxRate > 0 ? settings.defaultFxRate : null;
    const result = await prisma.card.createMany({
      data: cards.map((c) => ({
        name: c.name,
        purchasePriceJpy: c.purchasePriceJpy,
        sellPriceUsd: c.sellPriceUsd,
        setName: c.setName,
        cardNumber: c.cardNumber,
        rarity: c.rarity,
        supplier: c.supplier,
        tags: c.tags,
        imageUrl: c.imageUrl,
        fxRate: fx,
      })),
    });

    revalidatePath("/");
    return {
      status: "success",
      message: `${result.count} 件のカードを登録しました${skipped > 0 ? `（${skipped} 行はスキップ）` : ""}。`,
      importedCount: result.count,
    };
  } catch (err) {
    logger.error("一括登録に失敗", err);
    return {
      status: "error",
      message: "一括登録中にエラーが発生しました。時間をおいて再度お試しください。",
    };
  }
}

/** フォームの hidden から数値 id を取り出す（不正なら null）。 */
function parseId(formData: FormData): number | null {
  const raw = formData.get("id");
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * カードを更新する。id は hidden フィールドで受け取る。
 */
export async function updateCard(
  _prev: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const id = parseId(formData);
  if (id === null) {
    return { status: "error", message: "対象カードを特定できませんでした。" };
  }

  const parsed = parseCardForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "入力内容に誤りがあります。赤いメッセージをご確認ください。",
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    const data = parsed.data;
    // 予想の固定には「更新前の販売価格」が要る（forecast.ts の説明を参照）。
    const before = await prisma.card.findUnique({
      where: { id },
      select: { sellPriceUsd: true, predictedSellUsd: true },
    });
    if (!before) {
      return { status: "error", message: "対象カードが見つかりませんでした。" };
    }
    const card = await prisma.card.update({
      where: { id },
      data: {
        name: data.name,
        cardNumber: data.cardNumber ?? null,
        setName: data.setName ?? null,
        rarity: data.rarity ?? null,
        language: data.language,
        condition: data.condition,
        imageUrl: data.imageUrl ?? null,
        purchasePriceJpy: data.purchasePriceJpy,
        supplier: data.supplier ?? null,
        domesticBuybackJpy: data.domesticBuybackJpy,
        purchasedAt: data.purchasedAt ?? null,
        stock: data.stock,
        sellPriceUsd: data.sellPriceUsd,
        shippingChargedUsd: data.shippingChargedUsd,
        fxRate: data.fxRate ?? null,
        shippingJpy: data.shippingJpy,
        gradedShippingJpy: data.gradedShippingJpy,
        weightGrams: data.weightGrams ?? null,
        psa10SellUsd: data.psa10SellUsd,
        psa9SellUsd: data.psa9SellUsd,
        psa10Prob: data.psa10Prob,
        gradingPlan: data.gradingPlan,
        predictedSellUsd: nextPredictedSellUsd({
          current: before.predictedSellUsd,
          previousSellUsd: before.sellPriceUsd,
          nextSellUsd: data.sellPriceUsd,
          nextStatus: data.status,
        }),
        status: data.status,
        soldPriceUsd: data.soldPriceUsd,
        soldAt: data.soldAt ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? null,
      },
    });

    const settings = await getSettings();
    // 売却済になったこの瞬間の条件を固定する（既にあれば触らない）
    const saved = await pinSoldContext(card, settings);
    const profit = computeCardProfit(saved, settings);

    // 価格履歴に記録（推移グラフ用）
    await recordPriceHistory(saved, settings);

    revalidatePath("/");
    revalidatePath(`/cards/${id}/edit`);
    revalidatePath(`/cards/${id}`);

    return {
      status: "success",
      message: `「${card.name}」を更新しました。`,
      created: {
        id: card.id,
        name: card.name,
        profitJpy: profit.profitJpy,
        profitRate: profit.profitRate,
        decisionLabel: profit.decisionLabel,
        score: profit.score,
      },
    };
  } catch (err) {
    logger.error("カード更新に失敗", err);
    return {
      status: "error",
      message: "更新中にエラーが発生しました。対象カードが存在するかご確認ください。",
    };
  }
}

/**
 * カードを削除する（ダッシュボードの削除ボタンから form action で呼ぶ）。
 * PriceHistory はスキーマの onDelete: Cascade で一緒に削除される。
 */
export async function deleteCard(formData: FormData): Promise<void> {
  const id = parseId(formData);
  if (id === null) {
    logger.warn("削除: 不正なid", { raw: formData.get("id") });
    return;
  }
  try {
    await prisma.card.delete({ where: { id } });
    revalidatePath("/");
  } catch (err) {
    logger.error("カード削除に失敗", err);
    // 画面は一覧が再検証されるだけ。存在しないid等でもクラッシュさせない。
  }
}

/**
 * 買取額をまとめて更新する。
 *
 * 入力は `buyback_<カードID>` という名前のフィールド群。カード名で突き合わせると
 * 同名カード（番号違いのリザードンex SAR など）を取り違えるため、IDで確実に指定する。
 * 値が変わっていない行は更新しない（無駄な書き込みと updatedAt の更新を避ける）。
 */
export async function updateBuybackPrices(
  _prev: BuybackFormState,
  formData: FormData,
): Promise<BuybackFormState> {
  const entries: { id: number; value: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    const m = key.match(/^buyback_(\d+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const text = String(raw).trim();
    const value = text === "" ? 0 : Number(text);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!Number.isFinite(value) || value < 0) {
      return { status: "error", message: "買取額は0以上の数値で入力してください。" };
    }
    entries.push({ id, value: Math.round(value) });
  }

  if (entries.length === 0) {
    return { status: "error", message: "更新する対象がありませんでした。" };
  }

  try {
    // 変化があった行だけ更新する
    const current = await prisma.card.findMany({
      where: { id: { in: entries.map((e) => e.id) } },
      select: { id: true, domesticBuybackJpy: true },
    });
    const now = new Map(current.map((c) => [c.id, c.domesticBuybackJpy]));
    const changed = entries.filter((e) => now.get(e.id) !== e.value);

    if (changed.length === 0) {
      return { status: "success", message: "変更はありませんでした。", updatedCount: 0 };
    }

    await prisma.$transaction(
      changed.map((e) =>
        prisma.card.update({
          where: { id: e.id },
          data: { domesticBuybackJpy: e.value },
        }),
      ),
    );

    revalidatePath("/");
    revalidatePath("/cards/buyback");
    return {
      status: "success",
      message: `${changed.length} 件の買取額を更新しました。`,
      updatedCount: changed.length,
    };
  } catch (err) {
    logger.error("買取額の一括更新に失敗", err);
    return { status: "error", message: "更新に失敗しました。時間をおいて再度お試しください。" };
  }
}
