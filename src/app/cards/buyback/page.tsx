// 買取額の一括入力ページ。
// 買取チェッカー等で調べた国内買取額をまとめて入れて、
// 「国内で売る / 海外に出す」をその場で見比べる。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildProfitInputs } from "@/lib/cardProfit";
import { netBeforePurchaseJpy } from "@/lib/advice";
import { BuybackForm, type BuybackRow } from "./BuybackForm";

export const metadata = { title: "買取額の一括入力 | ポケカ利益判定ツール" };

export default async function BuybackPage() {
  const [cards, settings] = await Promise.all([
    prisma.card.findMany({ orderBy: { id: "asc" } }),
    getSettings(),
  ]);

  const rows: BuybackRow[] = cards.map((card) => ({
    id: card.id,
    name: card.name,
    cardNumber: card.cardNumber,
    setName: card.setName,
    imageUrl: card.imageUrl,
    // 海外の手取り＝売上−諸経費（仕入れは引かない）。行ごとに前もって計算しておく
    exportNetJpy: Math.round(netBeforePurchaseJpy(buildProfitInputs(card, settings))),
    domesticBuybackJpy: card.domesticBuybackJpy,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">買取額の一括入力</h1>
          <p className="text-xs text-black/50 dark:text-white/50">登録 {rows.length} 件</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ダッシュボード
        </Link>
      </div>

      <p className="mb-5 rounded-md border border-black/10 bg-black/[0.02] p-3 text-sm text-black/70 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/70">
        買取チェッカー等で調べた<b>国内の買取額</b>を入れてください。
        入力すると、その店に売る場合と eBay に出す場合のどちらが手元に多く残るかが右に出ます。
      </p>

      {rows.length === 0 ? (
        <div className="rounded-md border border-black/10 p-8 text-center text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          カードが登録されていません。
        </div>
      ) : (
        <BuybackForm rows={rows} minExportGainJpy={settings.minExportGainJpy} />
      )}
    </main>
  );
}
