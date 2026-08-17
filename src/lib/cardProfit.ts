// DB のカード・設定から利益計算の入力を組み立てて calcProfit を呼ぶブリッジ。
// これにより計算本体（profit.ts）は DB 型に依存せず純粋なまま保てる。

import type { Card, Settings } from "@/generated/prisma/client";
import { calcProfit, type ProfitInputs, type ProfitResult } from "@/lib/profit";
import { maxPurchaseForRate, breakEvenSellUsd } from "@/lib/advice";

/** カードと設定から利益計算の入力を作る（為替はカード優先、無ければ設定の既定値）。 */
export function buildProfitInputs(card: Card, settings: Settings): ProfitInputs {
  return {
    purchasePriceJpy: card.purchasePriceJpy,
    sellPriceUsd: card.sellPriceUsd,
    shippingChargedUsd: card.shippingChargedUsd,
    fxRate: card.fxRate ?? settings.defaultFxRate,
    shippingJpy: card.shippingJpy,
    ebayFeePct: settings.ebayFeePct,
    ebayFixedFeeUsd: settings.ebayFixedFeeUsd,
    paymentFeePct: settings.paymentFeePct,
    fxFeePct: settings.fxFeePct,
    tariffRatePct: settings.tariffRatePct,
    packingJpy: settings.packingJpy,
    otherFeeJpy: settings.otherFeeJpy,
    thresholdBuyPct: settings.thresholdBuyPct,
    thresholdConsiderPct: settings.thresholdConsiderPct,
    minProfitJpy: settings.minProfitJpy,
  };
}

/** カード＋設定から利益結果を計算する。 */
export function computeCardProfit(card: Card, settings: Settings): ProfitResult {
  return calcProfit(buildProfitInputs(card, settings));
}

/** 使用した為替レート（カード優先→設定既定）を返す。画面表示用。 */
export function resolveFxRate(card: Card, settings: Settings): number {
  return card.fxRate ?? settings.defaultFxRate;
}

/** カードの補助指標（上限仕入れ・損益分岐）。 */
export interface CardAdvice {
  maxPurchaseJpy: number | null; // 目標利益率を満たす上限仕入れ額
  breakEvenSellUsd: number | null; // 利益0の販売価格(USD)
  targetRatePct: number; // 目標利益率（= 仕入れ候補しきい値）
}

export function computeCardAdvice(card: Card, settings: Settings): CardAdvice {
  const inputs = buildProfitInputs(card, settings);
  return {
    maxPurchaseJpy: maxPurchaseForRate(inputs, settings.thresholdBuyPct),
    breakEvenSellUsd: breakEvenSellUsd(inputs),
    targetRatePct: settings.thresholdBuyPct,
  };
}

/** 実現損益（売却済カード）。売却価格で利益を計算する。 */
export function computeRealizedProfit(card: Card, settings: Settings): ProfitResult {
  const inputs = buildProfitInputs(card, settings);
  return calcProfit({ ...inputs, sellPriceUsd: card.soldPriceUsd });
}
