// 予想と実績のズレ。
//
// 目的: 「売れると思った値段」と「実際に売れた値段」を突き合わせて、
// 自分の見積もりが甘いのか辛いのかを知る。傾向が分かれば判定しきい値を
// 調整でき、売るほど精度が上がる。
//
// 為替について:
//   予想利益・実績利益はどちらも「今の設定の為替」で計算する。売却当時の
//   為替は記録していないし、記録していても混ぜると「価格の読み違い」と
//   「為替の変動」が混ざって、どちらが原因か分からなくなる。
//   ここで測りたいのは前者なので、為替は揃えて価格の差だけを見る。

import { median } from "@/lib/stats";

/** ズレの向き。ON = 誤差の範囲内。 */
export type ForecastVerdict = "OVER" | "UNDER" | "ON";

/** 1件分の予想と実績。 */
export interface ForecastItem {
  predictedSellUsd: number; // 売る前に見込んだ販売価格
  soldPriceUsd: number; // 実際に売れた価格
  predictedProfitJpy: number; // 見込んだ利益
  actualProfitJpy: number; // 実際の利益
}

/** 1件分のズレ。 */
export interface ForecastDiff {
  priceDiffUsd: number; // 実績 − 予想（USD）
  priceDiffPct: number | null; // 予想に対する差(%)。予想が0なら null
  profitDiffJpy: number; // 実績 − 予想（円）
  verdict: ForecastVerdict;
}

/** 予想と実績が揃っていて比較できるか。 */
export function isComparable(item: {
  predictedSellUsd: number;
  soldPriceUsd: number;
}): boolean {
  return item.predictedSellUsd > 0 && item.soldPriceUsd > 0;
}

/** 誤差の許容幅(%)。これ以内なら「ほぼ予想どおり」とみなす。 */
export const TOLERANCE_PCT = 5;

/** 1件のズレを求める。 */
export function diffForecast(
  item: ForecastItem,
  tolerancePct: number = TOLERANCE_PCT,
): ForecastDiff {
  const priceDiffUsd = item.soldPriceUsd - item.predictedSellUsd;
  const priceDiffPct =
    item.predictedSellUsd > 0
      ? (priceDiffUsd / item.predictedSellUsd) * 100
      : null;
  const profitDiffJpy = Math.round(item.actualProfitJpy - item.predictedProfitJpy);

  let verdict: ForecastVerdict = "ON";
  if (priceDiffPct !== null) {
    if (priceDiffPct > tolerancePct) verdict = "OVER";
    else if (priceDiffPct < -tolerancePct) verdict = "UNDER";
  }
  return { priceDiffUsd, priceDiffPct, profitDiffJpy, verdict };
}

/** 予想のクセ。 */
export type ForecastBias = "OPTIMISTIC" | "PESSIMISTIC" | "BALANCED";

export const BIAS_LABELS: Record<ForecastBias, string> = {
  OPTIMISTIC: "予想が高すぎる傾向",
  PESSIMISTIC: "予想が低すぎる傾向",
  BALANCED: "大きな偏りなし",
};

/**
 * 傾向と言うために最低限ほしい件数。
 * これを下回るうちは数字を出しても偶然と区別がつかないので、
 * 画面側で「まだ傾向とは言えない」と断る。
 */
export const MIN_SAMPLES = 5;

export interface ForecastSummary {
  count: number; // 比較できた件数
  medianPriceDiffPct: number | null; // 価格のズレの中央値(%)
  totalProfitDiffJpy: number; // 利益の差の合計（円）
  overCount: number; // 予想より高く売れた件数
  underCount: number; // 予想より安かった件数
  onCount: number; // ほぼ予想どおりの件数
  bias: ForecastBias | null;
  reliable: boolean; // 件数が MIN_SAMPLES 以上か
}

export { median } from "@/lib/stats";

/** 複数件をまとめて傾向を出す。比較できない件は自動的に除く。 */
export function summarizeForecast(
  items: ForecastItem[],
  tolerancePct: number = TOLERANCE_PCT,
): ForecastSummary {
  const usable = items.filter(isComparable);
  const diffs = usable.map((i) => diffForecast(i, tolerancePct));
  const pcts = diffs
    .map((d) => d.priceDiffPct)
    .filter((p): p is number => p !== null);

  const med = median(pcts);
  let bias: ForecastBias | null = null;
  if (med !== null) {
    if (med < -tolerancePct) bias = "OPTIMISTIC";
    else if (med > tolerancePct) bias = "PESSIMISTIC";
    else bias = "BALANCED";
  }

  return {
    count: usable.length,
    medianPriceDiffPct: med,
    totalProfitDiffJpy: diffs.reduce((a, d) => a + d.profitDiffJpy, 0),
    overCount: diffs.filter((d) => d.verdict === "OVER").length,
    underCount: diffs.filter((d) => d.verdict === "UNDER").length,
    onCount: diffs.filter((d) => d.verdict === "ON").length,
    bias,
    reliable: usable.length >= MIN_SAMPLES,
  };
}

/**
 * 保存時に「予想」として固定する販売価格を決める。
 *
 * 判断の要点は「更新前の値を使う」こと。売れたときに
 * ステータスを売却済にしつつ販売価格を実売額へ直す操作は自然に起きるが、
 * 更新後の値を掴むと予想＝実績になってズレが常に0になり、意味を失う。
 *
 * 一度記録した予想は上書きしない。最初に見込んだ額こそが予想だから。
 */
export function nextPredictedSellUsd(args: {
  current: number; // いま記録されている予想（0 = 未記録）
  previousSellUsd: number; // 更新前の販売価格（新規登録では0）
  nextSellUsd: number; // 更新後の販売価格
  nextStatus: string; // 更新後のステータス
}): number {
  if (args.current > 0) return args.current;
  if (args.nextStatus !== "LISTED" && args.nextStatus !== "SOLD") return 0;
  return args.previousSellUsd > 0 ? args.previousSellUsd : args.nextSellUsd;
}
