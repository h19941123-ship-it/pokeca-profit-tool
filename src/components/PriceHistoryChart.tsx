"use client";

// 価格履歴の推移グラフ（系列切り替え付き）。
// 予想利益 / 利益率 / 販売価格 / 為替 をボタンで切り替えて1つのグラフに表示する。
// （一軸のみ・二軸は使わない。指標ごとに軸を切り替える方式）

import { useState } from "react";
import { LineChart, type ChartPoint } from "@/components/LineChart";
import { yen, usd } from "@/lib/format";

/** グラフに渡す1点分のデータ（すべてシリアライズ可能）。 */
export interface HistoryDatum {
  label: string; // x軸ラベル（日付）
  profitJpy: number;
  profitRate: number;
  sellPriceUsd: number;
  fxRate: number;
}

type MetricKey = "profit" | "rate" | "sell" | "fx";

const METRICS: Record<
  MetricKey,
  { label: string; get: (d: HistoryDatum) => number; fmt: (n: number) => string }
> = {
  profit: { label: "予想利益", get: (d) => d.profitJpy, fmt: (n) => yen(n) },
  rate: { label: "利益率", get: (d) => d.profitRate, fmt: (n) => `${Math.round(n * 10) / 10}%` },
  sell: { label: "販売価格", get: (d) => d.sellPriceUsd, fmt: (n) => usd(n) },
  fx: { label: "為替", get: (d) => d.fxRate, fmt: (n) => `${n}` },
};

const ORDER: MetricKey[] = ["profit", "rate", "sell", "fx"];

export function PriceHistoryChart({ data }: { data: HistoryDatum[] }) {
  const [metric, setMetric] = useState<MetricKey>("profit");
  const m = METRICS[metric];
  const points: ChartPoint[] = data.map((d) => ({ label: d.label, value: m.get(d) }));

  return (
    <div>
      {/* 系列切り替え（フィルタは1行でグラフの上に） */}
      <div className="mb-3 flex flex-wrap gap-2">
        {ORDER.map((key) => {
          const active = key === metric;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]"
              }
            >
              {METRICS[key].label}
            </button>
          );
        })}
      </div>

      <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
        <LineChart points={points} formatValue={m.fmt} ariaLabel={`${m.label}の推移`} />
      </div>
    </div>
  );
}
