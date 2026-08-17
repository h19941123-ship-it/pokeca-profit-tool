// カード登録ページ。共有の CardForm に createCard を渡す。

import Link from "next/link";
import { CardForm } from "@/app/cards/CardForm";
import { createCard } from "@/app/cards/actions";
import { getSettings } from "@/lib/settings";
import { pickProfitSettings } from "@/lib/previewProfit";

export const metadata = {
  title: "カード登録 | ポケカ利益判定ツール",
};

export default async function NewCardPage() {
  const settings = pickProfitSettings(await getSettings());

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">カード登録</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ダッシュボード
        </Link>
      </div>
      <CardForm
        action={createCard}
        submitLabel="カードを登録"
        resetOnSuccess
        settings={settings}
      />
    </main>
  );
}
