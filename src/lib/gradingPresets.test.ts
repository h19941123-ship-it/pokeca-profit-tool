import { describe, it, expect } from "vitest";
import { feeSpecToUsd, GRADING_PRESETS } from "./gradingPresets";

describe("feeSpecToUsd", () => {
  it("USD建てはそのまま返す", () => {
    expect(feeSpecToUsd({ usd: 79.99 }, 159)).toBe(79.99);
  });

  it("円建ては現在の為替でUSD換算（小数第2位）", () => {
    // ¥11,980 / 150 = 79.8666... → 79.87
    expect(feeSpecToUsd({ jpy: 11980 }, 150)).toBe(79.87);
    // 為替が変われば換算結果も変わる
    expect(feeSpecToUsd({ jpy: 11980 }, 160)).toBe(74.88);
  });

  it("不正な為替は150にフォールバック", () => {
    expect(feeSpecToUsd({ jpy: 15000 }, 0)).toBe(100);
    expect(feeSpecToUsd({ jpy: 15000 }, Number.NaN)).toBe(100);
  });
});

describe("GRADING_PRESETS", () => {
  it("3つのプリセットが定義されている", () => {
    expect(GRADING_PRESETS.map((p) => p.id)).toEqual(["psa_us", "agent_us", "psa_japan"]);
  });
});
