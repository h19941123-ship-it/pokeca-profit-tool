import { describe, it, expect } from "vitest";
import { calcProfit, type ProfitInputs } from "./profit";

// テスト用の基準入力（手数料はテストごとに上書きする）
function baseInputs(overrides: Partial<ProfitInputs> = {}): ProfitInputs {
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
    ...overrides,
  };
}

describe("calcProfit", () => {
  it("基本例: 売上=販売価格×為替、eBay手数料13%を差し引く", () => {
    const r = calcProfit(baseInputs({ ebayFeePct: 0.13 }));
    expect(r.revenueJpy).toBe(12000); // 80 * 150
    expect(r.fees.ebayJpy).toBe(1560); // 12000 * 0.13
    expect(r.totalCostJpy).toBe(6560); // 1560 + 5000
    expect(r.profitJpy).toBe(5440); // 12000 - 6560
    expect(r.profitRate).toBeCloseTo(108.8, 1);
    expect(r.decision).toBe("BUY");
    expect(r.score).toBe(100); // 利益率が候補しきい値の2倍以上 → 満点
  });

  it("内訳の整合: 売上 − 手数料合計 − 仕入れ = 利益", () => {
    const r = calcProfit(
      baseInputs({
        purchasePriceJpy: 4000,
        ebayFeePct: 0.13,
        paymentFeePct: 0.03,
        fxFeePct: 0.02,
        shippingJpy: 1200,
        packingJpy: 200,
        otherFeeJpy: 100,
      }),
    );
    const feeTotal =
      r.fees.ebayJpy +
      r.fees.paymentJpy +
      r.fees.fxJpy +
      r.fees.tariffJpy +
      r.fees.shippingJpy +
      r.fees.packingJpy +
      r.fees.otherJpy;
    expect(r.revenueJpy - feeTotal - 4000).toBe(r.profitJpy);
    expect(r.totalCostJpy).toBe(feeTotal + 4000);
  });

  it("購入者請求送料は売上に含まれ、手数料もそれに掛かる", () => {
    // 商品$70 + 購入者送料$10 = $80 → 売上12000。eBay13%は12000に対して。
    const r = calcProfit(baseInputs({ sellPriceUsd: 70, shippingChargedUsd: 10, ebayFeePct: 0.13 }));
    expect(r.revenueJpy).toBe(12000);
    expect(r.fees.ebayJpy).toBe(1560);
  });

  it("eBay定額手数料($0.40)が円換算で加算される", () => {
    const r = calcProfit(baseInputs({ ebayFeePct: 0.13, ebayFixedFeeUsd: 0.4 }));
    // 12000*0.13=1560 + round(0.4*150)=60 → 1620
    expect(r.fees.ebayJpy).toBe(1620);
  });

  it("関税(DDP)は商品価値に対して立替コストになる", () => {
    // 関税12.5% × 商品$80 × 150 = 1500
    const r = calcProfit(baseInputs({ tariffRatePct: 12.5 }));
    expect(r.fees.tariffJpy).toBe(1500); // 80*150*0.125
    // 売上12000 − 関税1500 − 仕入5000 = 5500
    expect(r.profitJpy).toBe(5500);
  });

  it("判定: 利益率が候補しきい値以上 → BUY", () => {
    // purchase 10000, revenue 14000, 手数料0 → profit 4000, rate 40%
    const r = calcProfit(
      baseInputs({ purchasePriceJpy: 10000, sellPriceUsd: 140, fxRate: 100 }),
    );
    expect(r.profitRate).toBeCloseTo(40, 5);
    expect(r.decision).toBe("BUY");
  });

  it("判定: 利益率が検討〜候補の間 → CONSIDER", () => {
    // purchase 10000, revenue 12500, 手数料0 → profit 2500, rate 25%
    const r = calcProfit(
      baseInputs({ purchasePriceJpy: 10000, sellPriceUsd: 125, fxRate: 100 }),
    );
    expect(r.profitRate).toBeCloseTo(25, 5);
    expect(r.decision).toBe("CONSIDER");
    expect(r.score).toBe(55); // 40 + (25-20)/(30-20)*30
  });

  it("判定: 利益率が検討しきい値未満 → SKIP", () => {
    // purchase 10000, revenue 11000 → profit 1000, rate 10%
    const r = calcProfit(
      baseInputs({ purchasePriceJpy: 10000, sellPriceUsd: 110, fxRate: 100 }),
    );
    expect(r.profitRate).toBeCloseTo(10, 5);
    expect(r.decision).toBe("SKIP");
    expect(r.score).toBe(20); // (10/20)*40
  });

  it("最低利益額を下回るとき: 利益率が高くても SKIP・スコアは頭打ち", () => {
    // purchase 100, revenue 150 → profit 50, rate 50%（本来なら BUY）
    const r = calcProfit(
      baseInputs({
        purchasePriceJpy: 100,
        sellPriceUsd: 1,
        fxRate: 150,
        minProfitJpy: 100, // 利益50 < 100
      }),
    );
    expect(r.profitJpy).toBe(50);
    expect(r.decision).toBe("SKIP");
    expect(r.score).toBeLessThanOrEqual(39);
  });

  it("仕入れ0円で利益プラス: 利益率は null、判定 BUY", () => {
    const r = calcProfit(
      baseInputs({ purchasePriceJpy: 0, sellPriceUsd: 10, fxRate: 150 }),
    );
    expect(r.profitJpy).toBe(1500);
    expect(r.profitRate).toBeNull();
    expect(r.decision).toBe("BUY");
    expect(r.score).toBe(80);
  });

  it("赤字: 利益マイナス → SKIP・スコア0", () => {
    const r = calcProfit(
      baseInputs({ purchasePriceJpy: 10000, sellPriceUsd: 10, fxRate: 150 }),
    );
    expect(r.profitJpy).toBeLessThan(0);
    expect(r.decision).toBe("SKIP");
    expect(r.score).toBe(0);
  });

  it("不正な数値(NaN)が来てもクラッシュせず 0 として扱う", () => {
    const r = calcProfit(
      baseInputs({ sellPriceUsd: Number.NaN, fxRate: Number.NaN }),
    );
    expect(r.revenueJpy).toBe(0);
    expect(r.profitJpy).toBe(-5000); // 売上0 − 仕入5000
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.decision).toBe("SKIP");
  });
});
