"use client";

// 一括インポートフォーム。テキストエリアに貼り付け → 一括登録。

import { useActionState } from "react";
import Link from "next/link";
import { importCards } from "@/app/cards/actions";
import { initialImportState } from "@/app/cards/import/importState";

const SAMPLE = `リザードンex,3000,120,黒炎の支配者,SAR,駿河屋
ミュウex,1500,60,,,メルカリ`;

export function ImportForm() {
  const [state, action, pending] = useActionState(importCards, initialImportState);

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-md border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/15 dark:bg-white/[0.03]">
        <p className="mb-1 font-semibold">貼り付け形式（1行1枚・カンマまたはタブ区切り）</p>
        <p className="text-black/60 dark:text-white/60">
          列順: <code>カード名, 仕入価格(円), 販売価格(USD), セット, 番号, レアリティ, 仕入先, タグ, 画像URL</code>
        </p>
        <p className="mt-1 text-black/60 dark:text-white/60">
          カード名以外は省略可。Excel/スプレッドシートからそのままコピー＆ペーストできます。
        </p>
      </div>

      <div>
        <label htmlFor="text" className="mb-1 block text-sm font-medium">
          取り込むデータ
        </label>
        <textarea
          id="text"
          name="text"
          rows={12}
          defaultValue={SAMPLE}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 font-mono text-sm dark:border-white/20 dark:bg-black/20"
          placeholder="リザードンex,3000,120,黒炎の支配者,SAR,駿河屋"
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {state.message}{" "}
          <Link href="/" className="underline">
            ダッシュボードで確認
          </Link>
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "登録中…" : "一括登録する"}
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ダッシュボード
        </Link>
      </div>
    </form>
  );
}
