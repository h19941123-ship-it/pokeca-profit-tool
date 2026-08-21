"use client";

// 監視対象の追加フォーム。

import { useActionState } from "react";
import { addWatchAction, type WatchFormState } from "./actions";
import { MARKETPLACES, DEFAULT_MARKETPLACE_ID } from "@/lib/marketplaces";

const initial: WatchFormState = { status: "idle" };

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-black";

export function WatchForm() {
  const [state, action, pending] = useActionState(addWatchAction, initial);

  return (
    <form action={action} className="rounded-md border border-black/10 p-4 dark:border-white/15">
      <h2 className="mb-1 text-base font-semibold">監視するカードを追加</h2>
      <p className="mb-3 text-xs text-black/55 dark:text-white/55">
        検索キーワードは<b>英語</b>で入れてください（eBayに日本語で問い合わせても当たりません）。
        例: <code className="rounded bg-black/5 px-1 dark:bg-white/10">charizard ex sar 201/165 japanese</code>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-black/60 dark:text-white/60">名前（日本語で可）</span>
          <input name="label" className={inputClass} placeholder="リザードンex SAR" required />
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-white/60">eBay検索キーワード（英語）</span>
          <input name="query" className={inputClass} placeholder="charizard ex sar japanese" required />
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-white/60">マーケット</span>
          <select name="marketplaceId" defaultValue={DEFAULT_MARKETPLACE_ID} className={inputClass}>
            {MARKETPLACES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-white/60">メモ（任意）</span>
          <input name="note" className={inputClass} placeholder="再販が来たら要確認" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "登録中…" : "追加して1回観測"}
        </button>
        {state.status !== "idle" && state.message && (
          <p className={`text-sm ${state.status === "error" ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
