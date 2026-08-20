// ダッシュボード用: カードに利益計算を適用して「行」を作り、並べ替える。
// 利益は保存値ではなく都度計算するため、ソートは全行を計算した後に JS で行う
// （MVP 規模では十分。件数が増えたら DB 側集計に移行できる）。

import type { Card, Settings } from "@/generated/prisma/client";
import { computeCardProfit, resolveFxRate } from "@/lib/cardProfit";
import { computeCardGrading } from "@/lib/cardGrading";
import type { ProfitResult } from "@/lib/profit";
import type { GradingResult } from "@/lib/grading";

/** 一覧の1行分（カード＋計算結果）。 */
export interface CardRow {
  card: Card;
  profit: ProfitResult;
  fxRate: number; // 使用した為替（カード優先→設定既定）
  sellingFeeJpy: number; // 販売手数料合計（eBay＋決済＋為替手数料）
  grading: GradingResult; // PSA鑑定シミュレーション
}

/** 並べ替えキー。 */
export type SortKey = "profitRate" | "profitJpy" | "score" | "createdAt";
/** 並び順。 */
export type SortDir = "asc" | "desc";

/** 有効な並べ替えキー一覧（クエリ検証用）。 */
export const SORT_KEYS: SortKey[] = [
  "profitRate",
  "profitJpy",
  "score",
  "createdAt",
];

/** カード配列から行を作る。 */
export function buildRows(cards: Card[], settings: Settings): CardRow[] {
  return cards.map((card) => {
    const profit = computeCardProfit(card, settings);
    return {
      card,
      profit,
      fxRate: resolveFxRate(card, settings),
      sellingFeeJpy:
        profit.fees.ebayJpy + profit.fees.paymentJpy + profit.fees.fxJpy,
      grading: computeCardGrading(card, settings),
    };
  });
}

/**
 * ダッシュボードのサマリー集計（在庫数を掛けた合計）。
 *
 * 売却済カードは除外する。手元に無いものを在庫として数えると総仕入額が
 * 回収済みの分まで膨らみ、予想総利益はレポートの実現損益と二重に計上される。
 * 一覧には残す（履歴として見たいため）が、集計からは外す。
 */
export interface DashboardSummary {
  totalStock: number; // 総在庫数（売却済を除く）
  totalCostJpy: number; // 総仕入額（仕入×在庫・売却済を除く）
  totalExpectedProfitJpy: number; // 予想総利益（利益×在庫・売却済を除く）
  avgProfitRate: number | null; // 平均利益率（利益率がある行の単純平均）
  buy: number; // 判定別 件数
  consider: number;
  skip: number;
  unset: number; // 仕入れ価格が未入力で判定できない件数
  soldCount: number; // 集計から外した売却済の件数
}

/** 全行からサマリーを計算する。 */
export function summarizeRows(rows: CardRow[]): DashboardSummary {
  let totalStock = 0;
  let totalCostJpy = 0;
  let totalExpectedProfitJpy = 0;
  let rateSum = 0;
  let rateCount = 0;
  let buy = 0;
  let consider = 0;
  let skip = 0;
  let unset = 0;
  let soldCount = 0;

  for (const { card, profit } of rows) {
    // 売却済は手元に無い。在庫・原価・予想利益・判定のどれにも数えない。
    if (card.status === "SOLD") {
      soldCount += 1;
      continue;
    }
    const qty = Math.max(card.stock, 0);
    totalStock += qty;
    totalCostJpy += card.purchasePriceJpy * qty;
    totalExpectedProfitJpy += profit.profitJpy * qty;
    if (profit.profitRate !== null) {
      rateSum += profit.profitRate;
      rateCount += 1;
    }
    if (profit.decision === "BUY") buy += 1;
    else if (profit.decision === "CONSIDER") consider += 1;
    else if (profit.decision === "UNSET") unset += 1;
    else skip += 1;
  }

  return {
    totalStock,
    totalCostJpy,
    totalExpectedProfitJpy,
    soldCount,
    avgProfitRate: rateCount > 0 ? Math.round((rateSum / rateCount) * 10) / 10 : null,
    buy,
    consider,
    skip,
    unset,
  };
}

/** 指定キー・方向で並べ替える（新しい配列を返す）。 */
export function sortRows(
  rows: CardRow[],
  key: SortKey,
  dir: SortDir,
): CardRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compare(a, b, key));
}

/** 2行を指定キーで比較（利益率が null の行は常に末尾へ）。 */
function compare(a: CardRow, b: CardRow, key: SortKey): number {
  switch (key) {
    case "profitRate": {
      const av = a.profit.profitRate;
      const bv = b.profit.profitRate;
      // null（仕入れ0円など）は昇順・降順いずれでも末尾に置く
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    }
    case "profitJpy":
      return a.profit.profitJpy - b.profit.profitJpy;
    case "score":
      return a.profit.score - b.profit.score;
    case "createdAt":
      return a.card.createdAt.getTime() - b.card.createdAt.getTime();
  }
}

/** クエリ文字列を安全な SortKey に変換（不正なら既定 profitRate）。 */
export function toSortKey(value: string | undefined): SortKey {
  return SORT_KEYS.includes(value as SortKey)
    ? (value as SortKey)
    : "profitRate";
}

/** クエリ文字列を安全な SortDir に変換（既定 desc）。 */
export function toSortDir(value: string | undefined): SortDir {
  return value === "asc" ? "asc" : "desc";
}

/**
 * 現在の searchParams に上書きを適用してクエリ文字列を作る（先頭に "?" 付き）。
 * ソートリンクが検索条件を保持したまま並べ替えるのに使う。
 * 値が undefined のキーは取り除く。
 */
export function mergeQuery(
  sp: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) params.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
