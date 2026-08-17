// カード一括インポートページ。

import { ImportForm } from "@/app/cards/import/ImportForm";

export const metadata = { title: "一括インポート | ポケカ利益判定ツール" };

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold">カード一括インポート</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        表計算ソフトやメモから複数枚をまとめて登録します。登録後、各カードで販売価格や鑑定情報を編集できます。
      </p>
      <ImportForm />
    </main>
  );
}
