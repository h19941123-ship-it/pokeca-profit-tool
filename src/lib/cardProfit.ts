// DB のカード・設定から利益計算の入力を組み立てて calcProfit を呼ぶブリッジ。
// これにより計算本体（profit.ts）は DB 型に依存せず純粋なまま保てる。

import type { Card, Settings } from "@/generated/prisma/client";
import { calcProfit, type ProfitInputs, type ProfitResult } from "@/lib/profit";
import { maxPurchaseForRate, breakEvenSellUsd } from "@/lib/advice";
import { compareChannels, type ChannelComparison } from "@/lib/channel";
import { bundleShipping, type BundledShipping } from "@/lib/shipping";
import type { ForecastItem } from "@/lib/forecast";
import { parseSoldContext } from "@/lib/soldContext";

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
  const bundle = resolveShipping(card, settings);
  // まとめ発送＝同じ買い手の1注文にN枚入る、ということ。荷物が1つなら
  // 注文単位の費用も1回分しか発生しないので、送料と同じく枚数で割る。
  //  - eBay定額手数料: 1注文あたり
  //  - 購入者に請求する送料: 1注文につき1回しか受け取れない
  const perOrder = Math.max(1, bundle.cards);
  return {
    purchasePriceJpy: card.purchasePriceJpy,
    sellPriceUsd: card.sellPriceUsd,
    shippingChargedUsd: card.shippingChargedUsd / perOrder,
    fxRate: card.fxRate ?? settings.defaultFxRate,
    shippingJpy: bundle.perCardJpy,
    ebayFeePct: settings.ebayFeePct,
    ebayFixedFeeUsd: settings.ebayFixedFeeUsd / perOrder,
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

/**
 * 実現損益（売却済カード）。
 *
 * 売却時点で固定した条件があればそれを使う。無いのは この機能より前に
 * 売れたカードで、その場合だけ現在の設定で概算する（estimated=true）。
 * 現在の設定で毎回計算し直すと、設定を触るたびに過去の実績が動く。
 */
export function computeRealizedProfit(
  card: Card,
  settings: Settings,
): ProfitResult & { estimated: boolean } {
  const snapshot = parseSoldContext(card.soldContext);
  const inputs = snapshot
    ? { ...snapshot, purchasePriceJpy: card.purchasePriceJpy, sellPriceUsd: card.soldPriceUsd }
    : { ...buildProfitInputs(card, settings), sellPriceUsd: card.soldPriceUsd };

  return { ...calcProfit(inputs), estimated: snapshot === null };
}

/** 売却時に固定する条件（仕入れ・販売価格を除いた計算前提）。 */
export function buildSoldContext(card: Card, settings: Settings) {
  const { purchasePriceJpy: _p, sellPriceUsd: _s, ...rest } = buildProfitInputs(card, settings);
  void _p;
  void _s;
  return rest;
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
