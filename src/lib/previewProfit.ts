// 入力フォームの「保存前ライブプレビュー」用の計算。
//
// 目的:
//   このツールの本来の使い方は「店頭でカードを見つけた → 仕入れるべきか即判断」。
//   これまでは DB に保存しないと判定が出なかったため、フォームの生値から
//   その場で利益・判定を出せるようにする。
//
// 計算本体は profit.ts / advice.ts をそのまま再利用するので、
// プレビューと保存後の値は必ず一致する。

import type { Settings } from "@/generated/prisma/client";
import { calcProfit, type ProfitInputs, type ProfitResult } from "@/lib/profit";
import { maxPurchaseForRate, breakEvenSellUsd } from "@/lib/advice";

/** クライアントに渡す設定の最小セット（Settings 全体を渡さない）。 */
export interface ProfitSettings {
  defaultFxRate: number;
  ebayFeePct: number;
  ebayFixedFeeUsd: number;
  paymentFeePct: number;
  fxFeePct: number;
  tariffRatePct: number;
  packingJpy: number;
  otherFeeJpy: number;
  thresholdBuyPct: number;
  thresholdConsiderPct: number;
  minProfitJpy: number;
}

/** DB の Settings から計算に必要な項目だけ取り出す。 */
export function pickProfitSettings(s: Settings): ProfitSettings {
  return {
    defaultFxRate: s.defaultFxRate,
    ebayFeePct: s.ebayFeePct,
    ebayFixedFeeUsd: s.ebayFixedFeeUsd,
    paymentFeePct: s.paymentFeePct,
    fxFeePct: s.fxFeePct,
    tariffRatePct: s.tariffRatePct,
    packingJpy: s.packingJpy,
    otherFeeJpy: s.otherFeeJpy,
    thresholdBuyPct: s.thresholdBuyPct,
    thresholdConsiderPct: s.thresholdConsiderPct,
    minProfitJpy: s.minProfitJpy,
  };
}

/** フォームから読み取った生の文字列値。 */
export interface PreviewRawValues {
  purchasePriceJpy?: string | null;
  sellPriceUsd?: string | null;
  shippingChargedUsd?: string | null;
  fxRate?: string | null;
  shippingJpy?: string | null;
}

/** 文字列を数値に。空欄・不正値は 0。 */
function n(v: string | null | undefined): number {
  if (v === null || v === undefined || v.trim() === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** 為替は「空欄なら設定の既定値」。0以下も既定値にフォールバックする。 */
export function resolvePreviewFxRate(
  raw: PreviewRawValues,
  s: ProfitSettings,
): number {
  const v = n(raw.fxRate);
  return v > 0 ? v : s.defaultFxRate;
}

/** フォームの生値＋設定から calcProfit の入力を作る。 */
export function buildPreviewInputs(
  raw: PreviewRawValues,
  s: ProfitSettings,
): ProfitInputs {
  return {
    purchasePriceJpy: n(raw.purchasePriceJpy),
    sellPriceUsd: n(raw.sellPriceUsd),
    shippingChargedUsd: n(raw.shippingChargedUsd),
    fxRate: resolvePreviewFxRate(raw, s),
    shippingJpy: n(raw.shippingJpy),
    ebayFeePct: s.ebayFeePct,
    ebayFixedFeeUsd: s.ebayFixedFeeUsd,
    paymentFeePct: s.paymentFeePct,
    fxFeePct: s.fxFeePct,
    tariffRatePct: s.tariffRatePct,
    packingJpy: s.packingJpy,
    otherFeeJpy: s.otherFeeJpy,
    thresholdBuyPct: s.thresholdBuyPct,
    thresholdConsiderPct: s.thresholdConsiderPct,
    minProfitJpy: s.minProfitJpy,
  };
}

/** プレビューの表示に必要な一式。 */
export interface PreviewResult {
  profit: ProfitResult;
  fxRate: number;
  sellingFeeJpy: number; // eBay＋決済＋為替手数料
  maxPurchaseJpy: number | null; // 目標利益率を出せる上限仕入れ額
  breakEvenSellUsd: number | null; // 赤字にならない販売価格の下限
  targetRatePct: number; // 目標利益率（＝仕入れ候補しきい値）
  /** 販売価格が未入力（0）→ まだ判定する材料がない。 */
  empty: boolean;
}

/** フォームの生値からプレビューを計算する。 */
export function computePreview(
  raw: PreviewRawValues,
  s: ProfitSettings,
): PreviewResult {
  const inputs = buildPreviewInputs(raw, s);
  const profit = calcProfit(inputs);
  return {
    profit,
    fxRate: inputs.fxRate,
    sellingFeeJpy:
      profit.fees.ebayJpy + profit.fees.paymentJpy + profit.fees.fxJpy,
    maxPurchaseJpy: maxPurchaseForRate(inputs, s.thresholdBuyPct),
    breakEvenSellUsd: breakEvenSellUsd(inputs),
    targetRatePct: s.thresholdBuyPct,
    empty: inputs.sellPriceUsd <= 0 && inputs.purchasePriceJpy <= 0,
  };
}
