// DB のカード・設定から利益計算の入力を組み立てて calcProfit を呼ぶブリッジ。
// これにより計算本体（profit.ts）は DB 型に依存せず純粋なまま保てる。

import type { Card, Settings } from "@/generated/prisma/client";
import { calcProfit, type ProfitInputs, type ProfitResult } from "@/lib/profit";
import { maxPurchaseForRate, breakEvenSellUsd } from "@/lib/advice";
import { compareChannels, type ChannelComparison } from "@/lib/channel";
import { bundleShipping, type BundledShipping } from "@/lib/shipping";
import type { ForecastItem } from "@/lib/forecast";

/**
 * このカードの実質送料（まとめ発送の按分後）。画面の内訳表示にも使う。
 * 素体・鑑定スラブで重量が違うため、どちらの送料を按分するかを呼び出し側が選べる。
 */
export function resolveShipping(
  card: Card,
  settings: Settings,
  opts?: { shippingJpy?: number; weightGrams?: number | null },
): BundledShipping {
  return bundleShipping(
    opts?.shippingJpy ?? card.shippingJpy,
    opts?.weightGrams !== undefined ? opts.weightGrams : card.weightGrams,
    settings.bundleCards,
  );
}

/** カードと設定から利益計算の入力を作る（為替はカード優先、無ければ設定の既定値）。 */
export function buildProfitInputs(card: Card, settings: Settings): ProfitInputs {
  return {
    purchasePriceJpy: card.purchasePriceJpy,
    sellPriceUsd: card.sellPriceUsd,
    shippingChargedUsd: card.shippingChargedUsd,
    fxRate: card.fxRate ?? settings.defaultFxRate,
    shippingJpy: resolveShipping(card, settings).perCardJpy,
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

/** カード＋設定から「国内で売るか／海外に出すか」を比較する。 */
export function computeCardChannel(
  card: Card,
  settings: Settings,
): ChannelComparison {
  return compareChannels(
    buildProfitInputs(card, settings),
    card.domesticBuybackJpy,
    settings.minExportGainJpy,
  );
}

/** 予想時点の利益（固定した予想価格で計算）。実績との比較にだけ使う。 */
export function computePredictedProfit(card: Card, settings: Settings): ProfitResult {
  return calcProfit({
    ...buildProfitInputs(card, settings),
    sellPriceUsd: card.predictedSellUsd,
  });
}

/**
 * 予想と実績の比較材料を作る。
 * 手数料・送料・為替はどちらも今の設定で揃え、販売価格の違いだけを残す。
 */
export function buildForecastItem(card: Card, settings: Settings): ForecastItem {
  return {
    predictedSellUsd: card.predictedSellUsd,
    soldPriceUsd: card.soldPriceUsd,
    predictedProfitJpy: computePredictedProfit(card, settings).profitJpy,
    actualProfitJpy: computeRealizedProfit(card, settings).profitJpy,
  };
}
