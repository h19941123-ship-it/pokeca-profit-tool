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
  bundleCards: 1, // 既定は1枚ずつ発送（従来どおりの計算）
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

describe("まとめ発送がプレビューに効く", () => {
  it("枚数を増やすと送料が下がり利益が増える", () => {
    const raw = {
      purchasePriceJpy: "4000",
      sellPriceUsd: "62",
      shippingJpy: "1200",
      weightGrams: "100",
    };
    const solo = computePreview(raw, settings);
    const five = computePreview(raw, { ...settings, bundleCards: 5 });

    expect(five.bundle.perCardJpy).toBe(408);
    expect(five.profit.fees.shippingJpy).toBe(408);
    expect(five.profit.profitJpy).toBeGreaterThan(solo.profit.profitJpy);
    // 差の内訳: 送料 (1200-408=792) ＋ eBay定額手数料の按分 ($0.40×150 の 4/5 = 48)。
    // 定額手数料は1注文あたりなので、1つの荷物にまとめれば1回しかかからない。
    expect(five.profit.profitJpy - solo.profit.profitJpy).toBe(792 + 48);
  });

  it("枚数1なら従来と同じ送料のまま", () => {
    const raw = { purchasePriceJpy: "4000", sellPriceUsd: "62", shippingJpy: "1200" };
    expect(computePreview(raw, settings).profit.fees.shippingJpy).toBe(1200);
  });
});

describe("まとめ発送のときの注文単位の費用", () => {
  it("購入者に請求する送料は1注文につき1回しか受け取れない", () => {
    const raw = {
      purchasePriceJpy: "4000",
      sellPriceUsd: "62",
      shippingJpy: "1200",
      weightGrams: "100",
      shippingChargedUsd: "10",
    };
    const solo = computePreview(raw, settings);
    const five = computePreview(raw, { ...settings, bundleCards: 5 });
    // 5枚まとめなら1枚あたりの受取送料は $2 相当。売上は単品より下がる。
    expect(five.profit.revenueJpy).toBeLessThan(solo.profit.revenueJpy);
  });
});
