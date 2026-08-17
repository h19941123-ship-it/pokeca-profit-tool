// カード編集ページ。既存カードを読み込み、フォームに初期値を入れて updateCard を渡す。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CardForm, type CardFieldDefaults } from "@/app/cards/CardForm";
import { updateCard } from "@/app/cards/actions";
import { ymd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { pickProfitSettings } from "@/lib/previewProfit";

export const metadata = {
  title: "カード編集 | ポケカ利益判定ツール",
};

/** null/undefined を空文字に、数値は文字列に変換。 */
function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

export default async function EditCardPage(props: PageProps<"/cards/[id]/edit">) {
  const { id } = await props.params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) notFound();

  const [card, settingsRaw] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId } }),
    getSettings(),
  ]);
  if (!card) notFound();
  const settings = pickProfitSettings(settingsRaw);

  const defaults: CardFieldDefaults = {
    id: card.id,
    name: card.name,
    cardNumber: s(card.cardNumber),
    setName: s(card.setName),
    rarity: s(card.rarity),
    language: card.language,
    condition: card.condition,
    imageUrl: s(card.imageUrl),
    purchasePriceJpy: s(card.purchasePriceJpy),
    supplier: s(card.supplier),
    purchasedAt: ymd(card.purchasedAt),
    stock: s(card.stock),
    sellPriceUsd: s(card.sellPriceUsd),
    shippingChargedUsd: s(card.shippingChargedUsd),
    fxRate: s(card.fxRate),
    shippingJpy: s(card.shippingJpy),
    gradedShippingJpy: s(card.gradedShippingJpy),
    weightGrams: s(card.weightGrams),
    psa10SellUsd: s(card.psa10SellUsd),
    psa9SellUsd: s(card.psa9SellUsd),
    psa10Prob: s(card.psa10Prob),
    gradingPlan: card.gradingPlan,
    status: card.status,
    soldPriceUsd: s(card.soldPriceUsd),
    soldAt: ymd(card.soldAt),
    notes: s(card.notes),
    tags: s(card.tags),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">カード編集</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ダッシュボード
        </Link>
      </div>
      <CardForm
        action={updateCard}
        defaults={defaults}
        submitLabel="変更を保存"
        settings={settings}
      />
    </main>
  );
}
