import { describe, it, expect } from "vitest";
import { parseFilters, applyComputedFilters, hasAnyFilter } from "./search";
import type { CardRow } from "./dashboard";
import type { ProfitResult } from "./profit";

/** テスト用の最小 CardRow を作る（profit の必要フィールドだけ埋める）。 */
function row(profitJpy: number, profitRate: number | null, decision: ProfitResult["decision"]): CardRow {
  return {
    card: {} as CardRow["card"],
    fxRate: 150,
    sellingFeeJpy: 0,
    profit: {
      revenueJpy: 0,
      fees: { ebayJpy: 0, paymentJpy: 0, fxJpy: 0, tariffJpy: 0, shippingJpy: 0, packingJpy: 0, otherJpy: 0 },
      totalCostJpy: 0,
      profitJpy,
      profitRate,
      decision,
      decisionLabel: decision,
      score: 0,
    },
    grading: {
      configured: false,
      gradingFeeJpy: 0,
      gradingTotalJpy: 0,
      totalInvestJpy: 0,
      profit10Jpy: 0,
      profit9Jpy: 0,
      expectedProfitJpy: 0,
      expectedProfitRate: null,
      rawProfitJpy: 0,
      deltaJpy: 0,
      worthGrading: false,
    },
  };
}

describe("parseFilters", () => {
  it("数値・判定を変換し、不正値は無視する", () => {
    const f = parseFilters({ q: " リザ ", minRate: "30", maxProfit: "abc", decision: "BUY" });
    expect(f.q).toBe("リザ");
    expect(f.minRate).toBe(30);
    expect(f.maxProfit).toBeUndefined(); // 不正 → undefined
    expect(f.decision).toBe("BUY");
  });

  it("不正な判定値は undefined", () => {
    expect(parseFilters({ decision: "XXX" }).decision).toBeUndefined();
  });
});

describe("applyComputedFilters", () => {
  const rows = [
    row(3440, 68.8, "BUY"),
    row(996, 24.9, "CONSIDER"),
    row(-1940, -64.67, "SKIP"),
    row(1500, null, "BUY"), // 仕入れ0円想定（利益率 null）
  ];

  it("利益率の下限で絞る（null は除外）", () => {
    const r = applyComputedFilters(rows, { minRate: 30 });
    expect(r.map((x) => x.profit.profitJpy)).toEqual([3440]);
  });

  it("利益額の下限で絞る", () => {
    const r = applyComputedFilters(rows, { minProfit: 1000 });
    expect(r.map((x) => x.profit.profitJpy).sort((a, b) => a - b)).toEqual([1500, 3440]);
  });

  it("判定で絞る", () => {
    const r = applyComputedFilters(rows, { decision: "CONSIDER" });
    expect(r).toHaveLength(1);
    expect(r[0].profit.decision).toBe("CONSIDER");
  });

  it("条件なしなら全件", () => {
    expect(applyComputedFilters(rows, {})).toHaveLength(4);
  });

  it("キーワードは大文字小文字を無視して照合", () => {
    const kwRows = [
      { ...row(1000, 10, "BUY"), card: { name: "Charizard ex", cardNumber: null, setName: null, rarity: null } as CardRow["card"] },
      { ...row(1000, 10, "BUY"), card: { name: "Pikachu", cardNumber: null, setName: null, rarity: null } as CardRow["card"] },
    ];
    expect(applyComputedFilters(kwRows, { q: "charizard" })).toHaveLength(1);
    expect(applyComputedFilters(kwRows, { q: "CHARIZARD" })).toHaveLength(1);
    expect(applyComputedFilters(kwRows, { q: "pika" })).toHaveLength(1);
  });
});

describe("hasAnyFilter", () => {
  it("何か指定があれば true", () => {
    expect(hasAnyFilter({ minRate: 30 })).toBe(true);
    expect(hasAnyFilter({})).toBe(false);
  });
});
