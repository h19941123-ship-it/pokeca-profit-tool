// PSA鑑定シミュレーション（生カードを鑑定して売る想定の期待利益）。
//
// 考え方:
//   総投資 = 生カード仕入 + 鑑定コスト（鑑定料 + 往復送料 + 代行手数料）
//   PSA10 が出る確率 p、PSA9以下が (1 - p)。
//   期待利益 = p × 利益(PSA10価格で販売) + (1 - p) × 利益(PSA9価格で販売)
//   各グレードの利益は通常の利益計算(calcProfit)を、
//   「仕入 = 生カード仕入 + 鑑定コスト」「販売 = そのグレードの価格」で流用する。
//
// これを「生で売る利益」と比較し、鑑定する価値があるかを示す（あくまで予想）。

import { calcProfit, type ProfitInputs } from "@/lib/profit";

/** 利益計算に共通で使う手数料・為替・送料など（仕入と販売以外）。 */
export type FeeBase = Omit<ProfitInputs, "purchasePriceJpy" | "sellPriceUsd">;

export interface GradingInputs {
  base: FeeBase; // 手数料率・為替・送料（スラブ送料）・しきい値など
  rawShippingJpy: number; // 素体で売る場合の送料（比較用。base.shippingJpy はスラブ送料）
  rawPurchaseJpy: number; // 素体カードの仕入価格（円）
  rawSellPriceUsd: number; // 素体のまま売る場合の価格（比較用）
  gradingFeeUsd: number; // PSA鑑定料（USD）
  gradingShipJpy: number; // 往復送料（円）
  gradingAgentJpy: number; // 代行手数料（円）
  psa10SellUsd: number; // PSA10 販売価格（USD）
  psa9SellUsd: number; // PSA9以下 販売価格（USD）
  psa10Prob: number; // PSA10 になる確率(%)
}

export interface GradingResult {
  configured: boolean; // 鑑定シナリオが入力されているか
  gradingFeeJpy: number; // 鑑定料の円換算
  gradingTotalJpy: number; // 鑑定コスト合計（円）
  totalInvestJpy: number; // 総投資（生仕入 + 鑑定コスト）
  profit10Jpy: number; // PSA10 で売れた場合の利益
  profit9Jpy: number; // PSA9以下 で売れた場合の利益
  expectedProfitJpy: number; // 期待利益
  expectedProfitRate: number | null; // 期待利益率（期待利益 ÷ 総投資 × 100）
  rawProfitJpy: number; // 生で売る場合の利益（比較）
  deltaJpy: number; // 期待利益 − 生利益（＋なら鑑定が有利）
  worthGrading: boolean; // 鑑定した方が期待利益が高いか
}

function safeNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 指定の仕入・販売で利益(円)を計算する小ヘルパー。 */
function profitFor(base: FeeBase, purchaseJpy: number, sellUsd: number): number {
  return calcProfit({ ...base, purchasePriceJpy: purchaseJpy, sellPriceUsd: sellUsd }).profitJpy;
}

/** PSA鑑定シミュレーションを計算する。 */
export function calcGrading(inputs: GradingInputs): GradingResult {
  const rawPurchase = safeNum(inputs.rawPurchaseJpy);
  const fx = safeNum(inputs.base.fxRate);
  const psa10Sell = safeNum(inputs.psa10SellUsd);
  const psa9Sell = safeNum(inputs.psa9SellUsd);

  // 鑑定シナリオが未入力なら計算しない。
  //
  // 確率も必須にする。schema の注記どおり psa10Prob=0 は「まだ調べていない」で
  // あって「絶対に10は出ない」ではない。価格だけ入れて確率を入れ忘れると
  // 「必ずPSA9で売れる」という前提で計算され、期待利益が −¥8,484 のような
  // 断定的な数字で出てしまう。仕入れ0円を「未調査」として判定しない
  // (profit.ts の Decision.UNSET) のと同じ理由。
  const priceEntered = psa10Sell > 0 || psa9Sell > 0;
  const probEntered = safeNum(inputs.psa10Prob) > 0;
  const configured = priceEntered && probEntered;

  const gradingFeeJpy = Math.round(safeNum(inputs.gradingFeeUsd) * fx);
  const gradingTotalJpy = gradingFeeJpy + Math.round(safeNum(inputs.gradingShipJpy)) + Math.round(safeNum(inputs.gradingAgentJpy));
  const totalInvestJpy = rawPurchase + gradingTotalJpy;

  const profit10Jpy = profitFor(inputs.base, totalInvestJpy, psa10Sell);
  const profit9Jpy = profitFor(inputs.base, totalInvestJpy, psa9Sell);

  // 確率は 0〜100 に丸める
  const p = Math.min(Math.max(safeNum(inputs.psa10Prob), 0), 100) / 100;
  const expectedProfitJpy = Math.round(p * profit10Jpy + (1 - p) * profit9Jpy);

  const expectedProfitRate = totalInvestJpy > 0 ? round2((expectedProfitJpy / totalInvestJpy) * 100) : null;

  // 素体で売る比較は「素体送料」を使う（base はスラブ送料のため上書き）
  const rawBase: FeeBase = { ...inputs.base, shippingJpy: safeNum(inputs.rawShippingJpy) };
  const rawProfitJpy = profitFor(rawBase, rawPurchase, safeNum(inputs.rawSellPriceUsd));
  const deltaJpy = expectedProfitJpy - rawProfitJpy;

  return {
    configured,
    gradingFeeJpy,
    gradingTotalJpy,
    totalInvestJpy,
    profit10Jpy,
    profit9Jpy,
    expectedProfitJpy,
    expectedProfitRate,
    rawProfitJpy,
    deltaJpy,
    worthGrading: configured && deltaJpy > 0,
  };
}
