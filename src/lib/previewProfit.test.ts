import { describe, it, expect } from "vitest";
import {
  computePreview,
  resolvePreviewFxRate,
  type ProfitSettings,
} from "@/lib/previewProfit";

const settings: ProfitSettings = {
  defaultFxRate: 150,
  ebayFeePct: 0.13,
  ebayFixedFeeUsd: 0.4,
  paymentFeePct: 0.03,
  fxFeePct: 0.02,
  tariffRatePct: 0,
  packingJpy: 200,
  otherFeeJpy: 0,
  thresholdBuyPct: 30,
  thresholdConsiderPct: 15,
  minProfitJpy: 500,
};

describe("resolvePreviewFxRate", () => {
  it("空欄なら設定の既定値", () => {
    expect(resolvePreviewFxRate({ fxRate: "" }, settings)).toBe(150);
    expect(resolvePreviewFxRate({}, settings)).toBe(150);
  });

  it("0以下も既定値にフォールバックする", () => {
    expect(resolvePreviewFxRate({ fxRate: "0" }, settings)).toBe(150);
    expect(resolvePreviewFxRate({ fxRate: "-10" }, settings)).toBe(150);
  });

  it("入力があればそれを使う", () => {
    expect(resolvePreviewFxRate({ fxRate: "160" }, settings)).toBe(160);
  });
});

describe("computePreview", () => {
  it("保存後の一覧と同じ数字になる（ダッシュボード1行目と一致）", () => {
    const r = computePreview(
      {
        purchasePriceJpy: "5000",
        sellPriceUsd: "80",
        shippingChargedUsd: "0",
        fxRate: "150",
        shippingJpy: "1200",
      },
      settings,
    );
    expect(r.profit.revenueJpy).toBe(12000);
    expect(r.sellingFeeJpy).toBe(2220);
    expect(r.profit.profitJpy).toBe(3380);
    expect(r.profit.profitRate).toBe(67.6);
    expect(r.profit.decision).toBe("BUY");
  });

  it("赤字なら見送り判定になる", () => {
    const r = computePreview(
      {
        purchasePriceJpy: "3000",
        sellPriceUsd: "20",
        shippingJpy: "1200",
      },
      settings,
    );
    expect(r.profit.profitJpy).toBeLessThan(0);
    expect(r.profit.decision).toBe("SKIP");
  });

  it("不正な文字列は 0 として扱いクラッシュしない", () => {
    const r = computePreview(
      { purchasePriceJpy: "abc", sellPriceUsd: "--" },
      settings,
    );
    expect(r.profit.profitJpy).toBeLessThanOrEqual(0);
    expect(r.empty).toBe(true);
  });

  it("上限仕入れ額と損益分岐価格を返す", () => {
    const r = computePreview(
      { purchasePriceJpy: "5000", sellPriceUsd: "80", shippingJpy: "1200" },
      settings,
    );
    expect(r.maxPurchaseJpy).toBe(6446);
    expect(r.breakEvenSellUsd).toBeGreaterThan(0);
    expect(r.targetRatePct).toBe(30);
  });
});
