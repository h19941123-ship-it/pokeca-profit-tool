import { describe, it, expect } from "vitest";
import {
  airpacketUsYen,
  estimateShippingJpy,
  calcUsShipping,
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
