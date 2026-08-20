// カード＋設定から PSA鑑定シミュレーションを計算するブリッジ。
// 鑑定料はプラン（レギュラー / エクスプレス）で切り替える。

import type { Card, Settings } from "@/generated/prisma/client";
import { resolveFxRate, resolveShipping } from "@/lib/cardProfit";
import { calcGrading, type GradingResult, type FeeBase } from "@/lib/grading";

/** 鑑定プラン。 */
export type GradingPlan = "REGULAR" | "EXPRESS";

/** プランのラベル。 */
export const PLAN_LABELS: Record<GradingPlan, string> = {
  REGULAR: "レギュラー",
  EXPRESS: "エクスプレス",
};

/** カードの gradingPlan を安全な GradingPlan に。 */
export function toPlan(value: string | null | undefined): GradingPlan {
  return value === "EXPRESS" ? "EXPRESS" : "REGULAR";
}

/** プランに対応する鑑定料(USD)を返す。 */
export function gradingFeeForPlan(settings: Settings, plan: GradingPlan): number {
  return plan === "EXPRESS" ? settings.gradingFeeExpressUsd : settings.gradingFeeRegularUsd;
}

/** 手数料・為替・送料などの共通ベースを作る（鑑定時はスラブ送料を使う）。 */
function feeBase(card: Card, settings: Settings): FeeBase {
  // 鑑定スラブは素体より重い。gradedShippingJpy があればそれを、無ければ素体送料を流用。
  const soloSlabJpy = card.gradedShippingJpy > 0 ? card.gradedShippingJpy : card.shippingJpy;
  // まとめ発送の按分はスラブにも効く。ただし素体より重いので、1個口に収まる枚数は
  // bundleShipping 側で自動的に少なくなる（重量はスラブ送料から逆算する）。
  const slabShippingJpy = resolveShipping(card, settings, {
    shippingJpy: soloSlabJpy,
    weightGrams: null,
  }).perCardJpy;
  return {
    shippingChargedUsd: card.shippingChargedUsd,
    fxRate: resolveFxRate(card, settings),
    shippingJpy: slabShippingJpy,
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

/** 指定プランで鑑定シミュレーションを計算する。 */
export function computeCardGradingByPlan(
  card: Card,
  settings: Settings,
  plan: GradingPlan,
): GradingResult {
  return calcGrading({
    base: feeBase(card, settings),
    rawShippingJpy: card.shippingJpy,
    rawPurchaseJpy: card.purchasePriceJpy,
    rawSellPriceUsd: card.sellPriceUsd,
    gradingFeeUsd: gradingFeeForPlan(settings, plan),
    gradingShipJpy: settings.gradingShipJpy,
    gradingAgentJpy: settings.gradingAgentJpy,
    psa10SellUsd: card.psa10SellUsd,
    psa9SellUsd: card.psa9SellUsd,
    psa10Prob: card.psa10Prob,
  });
}

/** カードが選択中のプランで計算する（ダッシュボード等で使用）。 */
export function computeCardGrading(card: Card, settings: Settings): GradingResult {
  return computeCardGradingByPlan(card, settings, toPlan(card.gradingPlan));
}

/** 両プランと選択中プランをまとめて返す（詳細ページの比較用）。 */
export function computeCardGradingBoth(card: Card, settings: Settings): {
  selected: GradingPlan;
  regular: GradingResult;
  express: GradingResult;
} {
  return {
    selected: toPlan(card.gradingPlan),
    regular: computeCardGradingByPlan(card, settings, "REGULAR"),
    express: computeCardGradingByPlan(card, settings, "EXPRESS"),
  };
}
