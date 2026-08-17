import { describe, it, expect } from "vitest";
import { calcGrading, type FeeBase, type GradingInputs } from "./grading";

// 手数料ゼロ・送料ゼロにして期待値の検算をしやすくする
const base: FeeBase = {
  shippingChargedUsd: 0,
  fxRate: 150,
  shippingJpy: 0,
  ebayFeePct: 0,
  ebayFixedFeeUsd: 0,
  paymentFeePct: 0,
  fxFeePct: 0,
  tariffRatePct: 0,
  packingJpy: 0,
  otherFeeJpy: 0,
  thresholdBuyPct: 30,
  thresholdConsiderPct: 20,
  minProfitJpy: 0,
};

function inputs(over: Partial<GradingInputs> = {}): GradingInputs {
  return {
    base,
    rawShippingJpy: 0,
    rawPurchaseJpy: 3000,
    rawSellPriceUsd: 30, // 生: 売上4500 - 3000 = 1500
    gradingFeeUsd: 20, // 20*150 = 3000円
    gradingShipJpy: 2000,
    gradingAgentJpy: 1000,
    psa10SellUsd: 200,
    psa9SellUsd: 60,
    psa10Prob: 40,
    ...over,
  };
}

describe("calcGrading", () => {
  it("鑑定コスト合計と総投資を計算", () => {
    const r = calcGrading(inputs());
    expect(r.gradingFeeJpy).toBe(3000); // 20USD * 150
    expect(r.gradingTotalJpy).toBe(6000); // 3000 + 2000 + 1000
    expect(r.totalInvestJpy).toBe(9000); // 3000 + 6000
  });

  it("各グレードの利益と期待利益（確率加重）", () => {
    const r = calcGrading(inputs());
    // 総投資9000。PSA10: 売上200*150=30000 - 9000 = 21000
    expect(r.profit10Jpy).toBe(21000);
    // PSA9: 売上60*150=9000 - 9000 = 0
    expect(r.profit9Jpy).toBe(0);
    // 期待利益 = 0.4*21000 + 0.6*0 = 8400
    expect(r.expectedProfitJpy).toBe(8400);
    // 期待利益率 = 8400 / 9000 * 100 = 93.33
    expect(r.expectedProfitRate).toBeCloseTo(93.33, 1);
  });

  it("生で売る利益と比較して鑑定が有利なら worthGrading", () => {
    const r = calcGrading(inputs());
    expect(r.rawProfitJpy).toBe(1500); // 生売り
    expect(r.deltaJpy).toBe(6900); // 8400 - 1500
    expect(r.worthGrading).toBe(true);
  });

  it("PSA10確率が低いと鑑定が不利になりうる", () => {
    const r = calcGrading(inputs({ psa10Prob: 0 }));
    // 期待利益 = PSA9利益 0 < 生利益 1500 → 鑑定は不利
    expect(r.expectedProfitJpy).toBe(0);
    expect(r.worthGrading).toBe(false);
  });

  it("PSA価格が未入力なら configured=false", () => {
    const r = calcGrading(inputs({ psa10SellUsd: 0, psa9SellUsd: 0 }));
    expect(r.configured).toBe(false);
    expect(r.worthGrading).toBe(false);
  });
});
