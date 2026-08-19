"use client";

// 買取額の一括入力。カードを一覧にして、各行に金額欄を1つ置く。
//
// 貼り付け方式にしなかった理由: 同名カード（番号違いのリザードンex SAR など）が
// あると突き合わせで取り違える。IDで確実に紐づく入力欄を並べる方が安全で速い。
//
// 入力するそばから「国内で売る / 海外に出す」の判定が出る。買取額を打った瞬間に
// 答えが見えないと、結局あとで1枚ずつ詳細ページを見に行くことになるため。

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateBuybackPrices } from "@/app/cards/actions";
import { initialBuybackState } from "./buybackState";
import { CardThumb } from "@/components/CardThumb";
import { yen } from "@/lib/format";
import { CHANNEL_LABELS, type Channel } from "@/lib/channel";

/** 画面に必要な最小限のカード情報（サーバー側で計算済みの手取りを含む）。 */
export interface BuybackRow {
  id: number;
  name: string;
  cardNumber: string | null;
  setName: string | null;
  imageUrl: string | null;
  /** 海外に出した場合の手取り（仕入れを引く前）。サーバーで計算済み。 */
  exportNetJpy: number;
  /** 現在の買取額。 */
  domesticBuybackJpy: number;
}

const BADGE: Record<Channel, string> = {
  EXPORT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  DOMESTIC: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  EITHER: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
};

/** 入力値から判定（サーバーの compareChannels と同じ規則）。 */
function judge(exportNet: number, buyback: number, minGain: number): Channel | null {
  if (!(buyback > 0)) return null;
  const gain = exportNet - buyback;
  if (gain > minGain) return "EXPORT";
  if (gain < 0) return "DOMESTIC";
  return "EITHER";
}

export function BuybackForm({
  rows,
  minExportGainJpy,
}: {
  rows: BuybackRow[];
  minExportGainJpy: number;
}) {
  const [state, action, pending] = useActionState(updateBuybackPrices, initialBuybackState);
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.id, r.domesticBuybackJpy > 0 ? String(r.domesticBuybackJpy) : ""])),
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "success" && (
        <p className="rounded-md border border-green-600/40 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
          ✅ {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="rounded-md border border-red-600/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {state.message}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const buyback = Number(values[r.id] ?? "");
          const ch = judge(r.exportNetJpy, buyback, minExportGainJpy);
          const gain = r.exportNetJpy - buyback;
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 p-3 dark:border-white/15"
            >
              <CardThumb url={r.imageUrl} alt={r.name} size={40} />
              <div className="min-w-0 flex-1">
                <Link href={`/cards/${r.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                  {r.name}
                </Link>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {[r.setName, r.cardNumber].filter(Boolean).join(" ・ ") || "—"}
                </div>
              </div>

              <div className="text-right text-xs text-black/50 dark:text-white/50">
                海外の手取り
                <div className="text-sm font-semibold tabular-nums text-black/80 dark:text-white/80">
                  {yen(r.exportNetJpy)}
                </div>
              </div>

              <label className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50">
                買取
                <input
                  name={`buyback_${r.id}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={values[r.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                  placeholder="0"
                  className="w-28 rounded-md border border-black/15 bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20"
                />
              </label>

              <div className="w-40 text-right">
                {ch ? (
                  <>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[ch]}`}>
                      {CHANNEL_LABELS[ch]}
                    </span>
                    <div className="mt-0.5 text-xs tabular-nums text-black/50 dark:text-white/50">
                      差額 {gain >= 0 ? "+" : ""}{yen(gain)}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-black/30 dark:text-white/30">未入力</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : "まとめて保存"}
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ダッシュボードへ
        </Link>
      </div>

      <p className="text-xs text-black/40 dark:text-white/40">
        ※「海外の手取り」は売上から eBay手数料・決済・為替・送料・梱包・関税を引いた額です。
        仕入れ値は両方に共通なので引いていません。差額が {yen(minExportGainJpy)} 以下なら
        発送の手間を考えて「どちらでも」と表示します（設定で変更できます）。
      </p>
    </form>
  );
}
