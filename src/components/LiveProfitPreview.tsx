"use client";

// 入力中にその場で利益・判定を出すプレビュー。
// 「仕入れ前に判断する」というツールの目的上、保存しないと判定が出ないのは遅いため、
// フォームの値が変わるたびに計算し直して常に画面上部に出しておく。

import { yen, usd, pct } from "@/lib/format";
import type { Decision } from "@/lib/profit";
import type { PreviewResult } from "@/lib/previewProfit";

const DECISION_STYLES: Record<Decision, string> = {
  BUY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CONSIDER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  SKIP: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  UNSET: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
};

export function LiveProfitPreview({ preview }: { preview: PreviewResult }) {
  const { profit } = preview;

  return (
    <section
      aria-live="polite"
      className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border dark:border-white/15 dark:bg-black/85"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">この条件での予想</h2>
        {preview.empty ? (
          <span className="text-xs text-black/50 dark:text-white/50">
            仕入れ価格と販売価格を入れると判定します
          </span>
        ) : (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DECISION_STYLES[profit.decision]}`}
          >
            {profit.decisionLabel}
          </span>
        )}
      </div>

      {/* 未入力のうちは固定費だけの数字が出て紛らわしいので伏せる */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Item label="予想利益">
          {preview.empty ? (
            <Blank />
          ) : (
            <span
              className={
                profit.profitJpy >= 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600"
              }
            >
              {yen(profit.profitJpy)}
            </span>
          )}
        </Item>
        <Item label="利益率">
          {preview.empty ? <Blank /> : pct(profit.profitRate)}
        </Item>
        <Item label="おすすめ度">
          {preview.empty ? <Blank /> : `${profit.score} / 100`}
        </Item>
        <Item label="予想売上">
          {preview.empty ? <Blank /> : yen(profit.revenueJpy)}
        </Item>
      </div>

      {!preview.empty && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-2 text-xs text-black/60 dark:border-white/10 dark:text-white/60">
          <span>
            上限仕入れ額（利益率{preview.targetRatePct}%）:{" "}
            <b className="text-black/80 dark:text-white/80">
              {preview.maxPurchaseJpy === null
                ? "利益が出ません"
                : `${yen(preview.maxPurchaseJpy)} まで`}
            </b>
          </span>
          <span>
            損益分岐の販売価格:{" "}
            <b className="text-black/80 dark:text-white/80">
              {preview.breakEvenSellUsd === null
                ? "—"
                : `${usd(preview.breakEvenSellUsd)} 以上`}
            </b>
          </span>
          <span>
            手数料 {yen(preview.sellingFeeJpy)} ／ 送料{" "}
            {yen(profit.fees.shippingJpy)}
            {preview.bundle.cards > 1 && (
              <span className="text-black/45 dark:text-white/45">
                {" "}
                （{preview.bundle.cards}枚まとめ・単品 {yen(preview.bundle.soloJpy)}）
              </span>
            )}{" "}
            ／ 梱包 {yen(profit.fees.packingJpy)} ／ 為替 {preview.fxRate}
          </span>
        </div>
      )}
    </section>
  );
}

function Blank() {
  return <span className="text-black/30 dark:text-white/30">—</span>;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-black/50 dark:text-white/50">{label}</div>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}
