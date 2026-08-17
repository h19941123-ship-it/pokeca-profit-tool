"use server";

// カード登録の Server Action。
// フォーム送信 → サーバーでバリデーション → DB 保存 → 利益プレビューを返す。
// エラーはユーザーに分かりやすい文言で返し、詳細はログに残す（クラッシュさせない）。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseCardForm } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { computeCardProfit } from "@/lib/cardProfit";
import { recordPriceHistory } from "@/lib/priceHistory";
import { parseImportText } from "@/lib/csvImport";
import { logger } from "@/lib/logger";
import type { CardFormState } from "@/app/cards/formState";
import type { ImportFormState } from "@/app/cards/import/importState";

/**
 * カードを新規登録する。
 * @param _prev 直前の状態（useActionState から渡る。未使用）
 * @param formData 送信されたフォーム
 */
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
        status: data.status,
        soldPriceUsd: data.soldPriceUsd,
        soldAt: data.soldAt ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? null,
      },
    });

    // 3) 利益プレビューを計算（登録直後に判定を見せる）
    const settings = await getSettings();
    const profit = computeCardProfit(card, settings);

    // 3.5) 価格履歴に記録（推移グラフ用）
    await recordPriceHistory(card, settings);

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
        status: data.status,
        soldPriceUsd: data.soldPriceUsd,
        soldAt: data.soldAt ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? null,
      },
    });

    const settings = await getSettings();
    const profit = computeCardProfit(card, settings);

    // 価格履歴に記録（推移グラフ用）
    await recordPriceHistory(card, settings);

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
