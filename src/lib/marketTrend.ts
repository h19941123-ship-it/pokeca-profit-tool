// 相場が上がってきているかの判定（純粋関数）。
//
// 前提と限界:
//   取得できるのは「出品中の希望価格」であって、実際に売れた価格ではない。
//   売り手が一斉に強気になっただけでも中央値は上がるため、値段だけを見て
//   「相場が上がった」と言うと外れる。
//
//   そこで出品件数を併せて見る。値段が上がり、かつ出品が減っているときは、
//   在庫が実際に買われて減っている可能性が高い。この2つが揃ったときだけを
//   「買われている」扱いにし、値段だけが上がっている状態と区別する。

import { median, changePct } from "@/lib/stats";

/** 定点観測1回分（判定に必要な項目だけ）。 */
export interface TrendSample {
  observedAt: Date;
  medianUsd: number;
  listingCount: number;
}

export type TrendSignal =
  | "HEATING" // 値上がり＋出品減 → 実際に買われている
  | "RISING" // 値上がりのみ → 売り手が強気になっただけかもしれない
  | "FLAT"
  | "FALLING"
  | "INSUFFICIENT"; // 判定に足る記録がない

export const SIGNAL_LABELS: Record<TrendSignal, string> = {
  HEATING: "買われている",
  RISING: "値上がり",
  FLAT: "横ばい",
  FALLING: "値下がり",
  INSUFFICIENT: "記録待ち",
};

/** 判定の設定。 */
export interface TrendOptions {
  now?: Date;
  recentDays?: number; // 直近とみなす日数
  lookbackDays?: number; // 比較する過去の範囲
  risePct?: number; // これ以上の変化で「動いた」とみなす(%)
  countDropPct?: number; // 出品件数がこれ以上減ったら在庫が減っているとみなす(%)
}

export const DEFAULTS = {
  recentDays: 3,
  lookbackDays: 14,
  risePct: 10,
  countDropPct: 10,
} as const;

export interface TrendResult {
  signal: TrendSignal;
  priceChangePct: number | null;
  countChangePct: number | null;
  recentMedianUsd: number | null;
  baseMedianUsd: number | null;
  recentListingCount: number | null;
  baseListingCount: number | null;
  /** 判定に使った記録の数。少ないほど当てにならない。 */
  used: { recent: number; base: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 直近と過去を比べて相場の向きを出す。
 *
 * 1点同士ではなく期間内の中央値どうしを比べる。1回の観測は、たまたま
 * 安い出品が1件あっただけで大きく振れるため。
 */
export function analyzeTrend(
  samples: TrendSample[],
  opts: TrendOptions = {},
): TrendResult {
  const now = opts.now ?? new Date();
  const recentDays = opts.recentDays ?? DEFAULTS.recentDays;
  const lookbackDays = opts.lookbackDays ?? DEFAULTS.lookbackDays;
  const risePct = opts.risePct ?? DEFAULTS.risePct;
  const countDropPct = opts.countDropPct ?? DEFAULTS.countDropPct;

  const recentEdge = now.getTime() - recentDays * DAY_MS;
  const baseEdge = now.getTime() - lookbackDays * DAY_MS;

  const recent = samples.filter((s) => s.observedAt.getTime() >= recentEdge);
  const base = samples.filter((s) => {
    const t = s.observedAt.getTime();
    return t < recentEdge && t >= baseEdge;
  });

  const empty: TrendResult = {
    signal: "INSUFFICIENT",
    priceChangePct: null,
    countChangePct: null,
    recentMedianUsd: median(recent.map((s) => s.medianUsd)),
    baseMedianUsd: median(base.map((s) => s.medianUsd)),
    recentListingCount: median(recent.map((s) => s.listingCount)),
    baseListingCount: median(base.map((s) => s.listingCount)),
    used: { recent: recent.length, base: base.length },
  };
  if (recent.length === 0 || base.length === 0) return empty;

  const priceChangePct = changePct(empty.baseMedianUsd!, empty.recentMedianUsd!);
  if (priceChangePct === null) return empty;
  const countChangePct = changePct(
    empty.baseListingCount!,
    empty.recentListingCount!,
  );

  let signal: TrendSignal;
  if (priceChangePct >= risePct) {
    // 値段が上がり、かつ出品が減っている＝在庫が買われている
    signal =
      countChangePct !== null && countChangePct <= -countDropPct
        ? "HEATING"
        : "RISING";
  } else if (priceChangePct <= -risePct) {
    signal = "FALLING";
  } else {
    signal = "FLAT";
  }

  return { ...empty, signal, priceChangePct, countChangePct };
}
