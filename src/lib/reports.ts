// レポート集計: 実現損益（売却済）・月次・仕入先別ランキング。

import type { Card, Settings } from "@/generated/prisma/client";
import { computeCardProfit, computeRealizedProfit, buildForecastItem } from "@/lib/cardProfit";
import { summarizeForecast, diffForecast, type ForecastSummary, type ForecastDiff } from "@/lib/forecast";

export interface MonthlyRow {
  month: string; // YYYY-MM
  profitJpy: number; // 実現損益合計
  count: number; // 売却件数
}
export interface SupplierRow {
  supplier: string;
  count: number;
  avgRatePct: number | null; // 予想利益率の平均
  totalExpectedProfitJpy: number; // 予想利益合計（在庫込）
}
/** 売却済カード1件分の「予想 vs 実績」。 */
export interface ForecastRow {
  id: number;
  name: string;
  soldAt: Date | null;
  predictedSellUsd: number;
  soldPriceUsd: number;
  diff: ForecastDiff;
}
export interface ReportData {
  soldCount: number;
  realizedTotalJpy: number;
  monthly: MonthlyRow[];
  suppliers: SupplierRow[];
  forecast: ForecastSummary; // 予想の精度
  forecastRows: ForecastRow[]; // 明細（新しい順）
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildReports(cards: Card[], settings: Settings): ReportData {
  // 実現損益（売却済）
  const sold = cards.filter((c) => c.status === "SOLD");
  let realizedTotalJpy = 0;
  const monthMap = new Map<string, { profitJpy: number; count: number }>();
  for (const c of sold) {
    const p = computeRealizedProfit(c, settings).profitJpy;
    realizedTotalJpy += p;
    const key = c.soldAt ? ym(c.soldAt) : "不明";
    const m = monthMap.get(key) ?? { profitJpy: 0, count: 0 };
    m.profitJpy += p;
    m.count += 1;
    monthMap.set(key, m);
  }
  const monthly = [...monthMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  // 予想と実績のズレ（比較できるのは予想を固定できていた売却済カードだけ）
  const items = sold.map((c) => buildForecastItem(c, settings));
  const forecast = summarizeForecast(items);
  const forecastRows: ForecastRow[] = sold
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      soldAt: c.soldAt,
      predictedSellUsd: c.predictedSellUsd,
      soldPriceUsd: c.soldPriceUsd,
      diff: diffForecast(items[i]),
    }))
    .filter((r) => r.predictedSellUsd > 0 && r.soldPriceUsd > 0)
    .sort((a, b) => (b.soldAt?.getTime() ?? 0) - (a.soldAt?.getTime() ?? 0));

  // 仕入先別ランキング（予想利益率）
  const supMap = new Map<string, { count: number; rateSum: number; rateCount: number; total: number }>();
  for (const c of cards) {
    const key = c.supplier?.trim() || "（未設定）";
    const prof = computeCardProfit(c, settings);
    const s = supMap.get(key) ?? { count: 0, rateSum: 0, rateCount: 0, total: 0 };
    s.count += 1;
    if (prof.profitRate !== null) {
      s.rateSum += prof.profitRate;
      s.rateCount += 1;
    }
    s.total += prof.profitJpy * Math.max(c.stock, 0);
    supMap.set(key, s);
  }
  const suppliers = [...supMap.entries()]
    .map(([supplier, v]) => ({
      supplier,
      count: v.count,
      avgRatePct: v.rateCount > 0 ? Math.round((v.rateSum / v.rateCount) * 10) / 10 : null,
      totalExpectedProfitJpy: v.total,
    }))
    .sort((a, b) => (b.avgRatePct ?? -Infinity) - (a.avgRatePct ?? -Infinity));

  return { soldCount: sold.length, realizedTotalJpy, monthly, suppliers, forecast, forecastRows };
}
