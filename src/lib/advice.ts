// 仕入れ判断の補助計算。
//  - 上限仕入れ価格: 目標利益率を達成できる最大の仕入れ額。
//  - 損益分岐の販売価格: 利益がちょうど0になる販売価格(USD)。
// 手数料は売上（販売価格）に依存し仕入れには依存しないため、逆算できる。

import { calcProfit, type ProfitInputs } from "@/lib/profit";

/** 仕入れを除いた手取り（円）= 売上 − 仕入以外のコスト。仕入れ額に依存しない。 */
export function netBeforePurchaseJpy(inputs: ProfitInputs): number {
  const r = calcProfit(inputs);
  return r.profitJpy + inputs.purchasePriceJpy;
}

/**
 * 目標利益率(%)を達成できる最大の仕入れ額（円）。
 * 手取り <= 0 なら達成不能で null。
 */
export function maxPurchaseForRate(inputs: ProfitInputs, targetRatePct: number): number | null {
  const net = netBeforePurchaseJpy(inputs);
  if (net <= 0) return null;
  const t = Number.isFinite(targetRatePct) ? targetRatePct : 0;
  return Math.floor(net / (1 + t / 100));
}

/**
 * 利益がちょうど0になる販売価格(USD)。二分探索で求める（利益は販売価格に単調増加）。
 * すでに0でも黒字なら0、現実的な範囲で黒字化不能なら null。
 */
export function breakEvenSellUsd(inputs: ProfitInputs): number | null {
  const profitAt = (sell: number) => calcProfit({ ...inputs, sellPriceUsd: sell }).profitJpy;
  if (profitAt(0) >= 0) return 0;
  let lo = 0;
  let hi = 100000;
  if (profitAt(hi) < 0) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}
