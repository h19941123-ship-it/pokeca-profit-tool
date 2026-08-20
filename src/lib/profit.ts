// =============================================================================
// 利益計算ロジック（このツールの核心）
//
// 方針:
//  - 純粋関数（DB や UI に依存しない）→ テストしやすく、後から拡張しやすい。
//  - 金額はすべて「円（整数）」に丸めてから合算する → 画面の数字が検算で一致する。
//  - 不正な数値（NaN 等）が来てもクラッシュしない（0 として扱う）。
//
// 計算式:
//   売上(円) = 販売価格(USD) × 為替レート(円/USD)
//   利益(円) = 売上
//            − eBay手数料 − 決済手数料 − 為替手数料
//            − 国際送料 − 梱包費 − その他手数料
//            − 仕入れ価格
//   利益率(%) = 利益 ÷ 仕入れ価格 × 100
//
// ※ 価格は変動するため、本結果は入力値に基づく「予想」であり保証ではない。
// =============================================================================

/**
 * 仕入れ判定の区分。
 *
 * UNSET は「仕入れ価格が未入力」。以前は仕入れ0円を「タダで手に入る＝
 * 利益率が無限大」と解釈して仕入れ候補にしていたが、実際の使い方では
 * 0円は「まだ価格を調べていない」を意味する。候補リストを一括登録すると
 * 全部が「仕入れ候補」に見えてしまい、判定として機能しなかった。
 */
export type Decision = "BUY" | "CONSIDER" | "SKIP" | "UNSET";

/** 判定区分の日本語ラベル。 */
export const DECISION_LABELS: Record<Decision, string> = {
  BUY: "仕入れ候補",
  CONSIDER: "検討",
  SKIP: "見送り",
  UNSET: "未設定",
};

/** 利益計算に必要な入力（すべて解決済みの値を渡す）。 */
export interface ProfitInputs {
  purchasePriceJpy: number; // 仕入れ価格（円）
  sellPriceUsd: number; // 想定販売価格（USD・商品本体）
  shippingChargedUsd: number; // 購入者に請求する送料（USD）。0=送料無料
  fxRate: number; // 為替レート（円/USD）
  shippingJpy: number; // 出品者が払う国際送料（円）
  ebayFeePct: number; // eBay手数料率（0.13 = 13%）
  ebayFixedFeeUsd: number; // eBay 1注文あたり定額手数料（USD）
  paymentFeePct: number; // 決済手数料率
  fxFeePct: number; // 為替/国際手数料率
  tariffRatePct: number; // 関税率(%)。DDPで出品者が立替（0=なし）
  packingJpy: number; // 梱包費（円）
  otherFeeJpy: number; // その他手数料（円）
  thresholdBuyPct: number; // 仕入れ候補となる利益率(%)
  thresholdConsiderPct: number; // 検討となる利益率(%)
  minProfitJpy: number; // 最低利益額（円）
}

/** 手数料の内訳（すべて円・整数）。 */
export interface FeeBreakdown {
  ebayJpy: number; // eBay手数料（率＋定額）
  paymentJpy: number;
  fxJpy: number;
  tariffJpy: number; // 関税立替（DDP）
  shippingJpy: number;
  packingJpy: number;
  otherJpy: number;
}

/** 利益計算の結果。 */
export interface ProfitResult {
  revenueJpy: number; // 売上（円）
  fees: FeeBreakdown; // 手数料内訳（円）
  totalCostJpy: number; // 総コスト（手数料合計＋仕入れ）（円）
  profitJpy: number; // 予想利益（円）
  profitRate: number | null; // 利益率(%)。仕入れ0円なら null（計算不能）
  decision: Decision; // 仕入れ判定
  decisionLabel: string; // 判定の日本語ラベル
  score: number; // 仕入れおすすめ度（0〜100）
}

/** スコアの調整用設定（将来ここに要素を追加して拡張できる）。 */
export const SCORE_CONFIG = {
  // 利益率が「仕入れ候補しきい値 × この倍率」に達したら満点(100)。
  excellentRateMultiplier: 2,
};

/** NaN / Infinity / 非数値を 0 に丸める安全化。 */
function safeNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** 値を [min, max] に収める。 */
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * 利益・利益率・判定・スコアを計算する。
 * 金額は各内訳を整数円に丸めてから合算するため、内訳の合計が利益と一致する。
 */
export function calcProfit(inputs: ProfitInputs): ProfitResult {
  const purchasePriceJpy = safeNum(inputs.purchasePriceJpy);
  const sellPriceUsd = safeNum(inputs.sellPriceUsd);
  const shippingChargedUsd = safeNum(inputs.shippingChargedUsd);
  const fxRate = safeNum(inputs.fxRate);
  const shippingJpy = Math.round(safeNum(inputs.shippingJpy));
  const packingJpy = Math.round(safeNum(inputs.packingJpy));
  const otherJpy = Math.round(safeNum(inputs.otherFeeJpy));

  // 売上（円）= (商品価格 + 購入者請求送料)(USD) × 為替
  //   eBay手数料は「商品＋購入者に請求した送料」に対してかかる。
  const grossUsd = sellPriceUsd + shippingChargedUsd;
  const revenueJpy = Math.round(grossUsd * fxRate);

  // eBay手数料 = 率 × 売上 ＋ 1注文あたり定額
  const ebayJpy =
    Math.round(revenueJpy * safeNum(inputs.ebayFeePct)) +
    Math.round(safeNum(inputs.ebayFixedFeeUsd) * fxRate);
  const paymentJpy = Math.round(revenueJpy * safeNum(inputs.paymentFeePct));
  const fxJpy = Math.round(revenueJpy * safeNum(inputs.fxFeePct));
  // 関税(DDP)は商品価値（商品本体）に対して立替
  const tariffJpy = Math.round(sellPriceUsd * fxRate * (safeNum(inputs.tariffRatePct) / 100));

  const fees: FeeBreakdown = {
    ebayJpy,
    paymentJpy,
    fxJpy,
    tariffJpy,
    shippingJpy,
    packingJpy,
    otherJpy,
  };

  const feeTotal = ebayJpy + paymentJpy + fxJpy + tariffJpy + shippingJpy + packingJpy + otherJpy;
  const totalCostJpy = feeTotal + purchasePriceJpy;

  // 予想利益（円）
  const profitJpy = revenueJpy - totalCostJpy;

  // 利益率(%)。仕入れ0円だと割り算不能なので null。
  const profitRate =
    purchasePriceJpy > 0 ? round2((profitJpy / purchasePriceJpy) * 100) : null;

  const decision = decide(profitJpy, profitRate, inputs);
  const score = calcScore(profitJpy, profitRate, inputs);

  return {
    revenueJpy,
    fees,
    totalCostJpy,
    profitJpy,
    profitRate,
    decision,
    decisionLabel: DECISION_LABELS[decision],
    score,
  };
}

/** 仕入れ判定。最低利益額を下回る場合は問答無用で「見送り」。 */
function decide(
  profitJpy: number,
  profitRate: number | null,
  inputs: ProfitInputs,
): Decision {
  const buyPct = safeNum(inputs.thresholdBuyPct);
  const considerPct = safeNum(inputs.thresholdConsiderPct);
  const minProfitJpy = safeNum(inputs.minProfitJpy);

  // 仕入れ価格が未入力なら判定しない。0円を「タダで仕入れた」と解釈すると
  // 利益率が無限大になり、調べていないカードが全部「仕入れ候補」に見える。
  if (profitRate === null) return "UNSET";

  // 最低利益額の下限を満たさない or 赤字 → 見送り
  if (profitJpy < minProfitJpy || profitJpy <= 0) return "SKIP";

  if (profitRate >= buyPct) return "BUY";
  if (profitRate >= considerPct) return "CONSIDER";
  return "SKIP";
}

/**
 * 仕入れおすすめ度（0〜100）。MVPは利益率を主軸にしたシンプルな配点。
 *  - 0% 〜 検討しきい値      → 0〜40 点
 *  - 検討しきい値 〜 候補しきい値 → 40〜70 点
 *  - 候補しきい値 〜 (候補×倍率)  → 70〜100 点
 * 最低利益額を下回る場合は 39 点で頭打ち（＝検討未満）。
 * 将来は販売数・価格安定性などの要素を加重して拡張する想定。
 */
function calcScore(
  profitJpy: number,
  profitRate: number | null,
  inputs: ProfitInputs,
): number {
  // 仕入れ価格が未入力なら評価できない
  if (profitRate === null) return 0;
  if (profitJpy <= 0) return 0;

  const buyPct = Math.max(safeNum(inputs.thresholdBuyPct), 0.01);
  const considerPct = clamp(safeNum(inputs.thresholdConsiderPct), 0.01, buyPct);
  const excellentPct = buyPct * SCORE_CONFIG.excellentRateMultiplier;

  let score: number;
  if (profitRate <= 0) {
    score = 0;
  } else if (profitRate < considerPct) {
    score = (profitRate / considerPct) * 40;
  } else if (profitRate < buyPct) {
    score = 40 + ((profitRate - considerPct) / (buyPct - considerPct)) * 30;
  } else {
    const span = Math.max(excellentPct - buyPct, 0.01);
    score = 70 + clamp((profitRate - buyPct) / span, 0, 1) * 30;
  }

  // 最低利益額の下限を満たさない場合は「検討未満」で頭打ち
  if (profitJpy < safeNum(inputs.minProfitJpy)) {
    score = Math.min(score, 39);
  }

  return Math.round(clamp(score, 0, 100));
}

/** 小数第2位で丸める。 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
