import { describe, it, expect } from "vitest";
import { maxPurchaseForRate, breakEvenSellUsd } from "./advice";
import type { ProfitInputs } from "./profit";

function inputs(over: Partial<ProfitInputs> = {}): ProfitInputs {
  return {
    purchasePriceJpy: 5000,
    sellPriceUsd: 80,
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
    ...over,
  };
}

describe("maxPurchaseForRate", () => {
  it("目標利益率30%を満たす上限仕入れ額", () => {
    // 手取り(仕入除く)=売上12000。max = floor(12000/1.3)=9230
    expect(maxPurchaseForRate(inputs(), 30)).toBe(9230);
  });
  it("手取りが0以下なら達成不能でnull", () => {
    // 売上0（販売価格0）→ 手取り0
    expect(maxPurchaseForRate(inputs({ sellPriceUsd: 0 }), 30)).toBeNull();
  });
});

describe("breakEvenSellUsd", () => {
  it("損益分岐の販売価格（利益0）", () => {
    // 仕入5000, 手数料0 → 売上5000で利益0 → sell=33.33
    const be = breakEvenSellUsd(inputs());
    expect(be).not.toBeNull();
    expect(be!).toBeCloseTo(33.34, 1);
  });
  it("仕入0円なら常に黒字→損益分岐は0", () => {
    expect(breakEvenSellUsd(inputs({ purchasePriceJpy: 0 }))).toBe(0);
  });
});
