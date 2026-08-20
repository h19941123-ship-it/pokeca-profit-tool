import { describe, it, expect } from "vitest";
import {
  airpacketUsYen,
  estimateShippingJpy,
  calcUsShipping,
  bundleShipping,
} from "./shipping";

describe("airpacketUsYen / estimateShippingJpy", () => {
  it("重量帯の境界で正しい料金を返す", () => {
    expect(airpacketUsYen(50)).toBe(1200); // ≤100g
    expect(airpacketUsYen(100)).toBe(1200);
    expect(airpacketUsYen(101)).toBe(1410); // 次の帯
    expect(airpacketUsYen(250)).toBe(1620); // ≤300g（鑑定スラブ想定）
    expect(airpacketUsYen(1000)).toBe(3090);
  });

  it("最大帯を超える重量は最大料金にフォールバック", () => {
    expect(airpacketUsYen(5000)).toBe(3090);
  });

  it("estimateShippingJpy は既定100gで郵便料金を返す", () => {
    expect(estimateShippingJpy()).toBe(1200);
    expect(estimateShippingJpy(250)).toBe(1620);
  });
});

describe("calcUsShipping (DDP・買い手への請求送料USD)", () => {
  it("生カード $25 / 100g / 150円: 郵便$8 + 関税$3.125 + buf$1 → 切上げ$13", () => {
    const { shippingUsd, breakdown } = calcUsShipping({ priceUsd: 25 });
    expect(breakdown.postalYen).toBe(1200);
    expect(breakdown.postalUsd).toBeCloseTo(8, 5);
    // breakdown は表示用に小数第2位で丸める（3.125 → 3.13）
    expect(breakdown.tariffUsd).toBe(3.13);
    // 切上げ前の raw は精密値 12.125 なので ceil = 13
    expect(shippingUsd).toBe(13);
  });

  it("鑑定スラブ $120 / 250g: 郵便$10.8 + 関税$15 + buf$1 → 切上げ$27", () => {
    const { shippingUsd, breakdown } = calcUsShipping({
      priceUsd: 120,
      weightGrams: 250,
    });
    expect(breakdown.postalYen).toBe(1620);
    expect(shippingUsd).toBe(27); // ceil(26.8)
    expect(breakdown.zonosFeeUsd).toBe(0);
  });

  it("為替が不正(0以下)なら既定150にフォールバックしてクラッシュしない", () => {
    const { shippingUsd } = calcUsShipping({ priceUsd: 25, fxRate: 0 });
    expect(Number.isFinite(shippingUsd)).toBe(true);
    expect(shippingUsd).toBe(13);
  });
});

describe("bundleShipping（まとめ発送の按分）", () => {
  it("1枚だけなら按分しない", () => {
    const r = bundleShipping(1200, 100, 1);
    expect(r.perCardJpy).toBe(1200);
    expect(r.cards).toBe(1);
  });

  it("100gのカードを5枚まとめると 500g=¥2,040 → 1枚あたり¥408", () => {
    const r = bundleShipping(1200, 100, 5);
    expect(r.bundleJpy).toBe(2040);
    expect(r.perCardJpy).toBe(408);
    expect(r.cards).toBe(5);
    expect(r.capped).toBe(false);
  });

  it("按分後は必ず単品送料より安いか同額になる", () => {
    for (const n of [2, 3, 4, 5, 8, 10]) {
      const r = bundleShipping(1200, 100, n);
      expect(r.perCardJpy).toBeLessThanOrEqual(r.soloJpy);
    }
  });

  it("重量が未入力なら送料から逆算する（¥1,200 → 100g帯）", () => {
    const r = bundleShipping(1200, null, 5);
    expect(r.perCardJpy).toBe(408);
  });

  it("1個口の上限(1000g)を超える枚数は頭打ちにする", () => {
    // スラブ250g × 5枚 = 1250g は1個口で送れない → 4枚(1000g)で頭打ち
    const r = bundleShipping(1620, 250, 5);
    expect(r.cards).toBe(4);
    expect(r.capped).toBe(true);
    expect(r.bundleJpy).toBe(3090);
  });

  it("重量が分からず送料も料金表の外なら按分しない（利益を過大に見せない）", () => {
    const r = bundleShipping(9000, null, 5);
    expect(r.perCardJpy).toBe(9000);
    expect(r.cards).toBe(1);
  });

  it("送料0円は0円のまま", () => {
    expect(bundleShipping(0, 100, 5).perCardJpy).toBe(0);
  });

  it("不正な枚数（0・負・NaN）は1枚として扱う", () => {
    for (const n of [0, -3, NaN]) {
      expect(bundleShipping(1200, 100, n).perCardJpy).toBe(1200);
    }
  });
});
