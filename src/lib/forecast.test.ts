import { describe, it, expect } from "vitest";
import {
  diffForecast,
  summarizeForecast,
  isComparable,
  median,
  MIN_SAMPLES,
  nextPredictedSellUsd,
} from "./forecast";

const item = (predicted: number, sold: number, pJpy = 0, aJpy = 0) => ({
  predictedSellUsd: predicted,
  soldPriceUsd: sold,
  predictedProfitJpy: pJpy,
  actualProfitJpy: aJpy,
});

describe("diffForecast", () => {
  it("予想より安く売れたら UNDER", () => {
    const d = diffForecast(item(100, 80, 5000, 2000));
    expect(d.verdict).toBe("UNDER");
    expect(d.priceDiffPct).toBeCloseTo(-20);
    expect(d.profitDiffJpy).toBe(-3000);
  });

  it("予想より高く売れたら OVER", () => {
    expect(diffForecast(item(100, 130)).verdict).toBe("OVER");
  });

  it("誤差5%以内は ON（ほぼ予想どおり）", () => {
    expect(diffForecast(item(100, 103)).verdict).toBe("ON");
    expect(diffForecast(item(100, 97)).verdict).toBe("ON");
  });

  it("境界ちょうど(±5%)は ON のまま", () => {
    expect(diffForecast(item(100, 105)).verdict).toBe("ON");
    expect(diffForecast(item(100, 95)).verdict).toBe("ON");
  });

  it("予想が0なら率は出せない", () => {
    expect(diffForecast(item(0, 80)).priceDiffPct).toBeNull();
  });
});

describe("isComparable", () => {
  it("予想と実績が両方そろって初めて比較できる", () => {
    expect(isComparable(item(100, 80))).toBe(true);
    expect(isComparable(item(0, 80))).toBe(false);
    expect(isComparable(item(100, 0))).toBe(false);
  });
});

describe("median", () => {
  it("奇数個・偶数個どちらも扱える", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("summarizeForecast", () => {
  it("比較できない件は除外して数える", () => {
    const s = summarizeForecast([item(100, 80), item(0, 80), item(100, 0)]);
    expect(s.count).toBe(1);
  });

  it("一貫して安く売れていれば「予想が高すぎる」と判定", () => {
    const s = summarizeForecast([
      item(100, 80), item(100, 82), item(100, 78), item(100, 85), item(100, 79),
    ]);
    expect(s.bias).toBe("OPTIMISTIC");
    expect(s.underCount).toBe(5);
    expect(s.reliable).toBe(true);
  });

  it("一貫して高く売れていれば「予想が低すぎる」と判定", () => {
    const s = summarizeForecast([
      item(100, 120), item(100, 115), item(100, 130), item(100, 118), item(100, 125),
    ]);
    expect(s.bias).toBe("PESSIMISTIC");
    expect(s.overCount).toBe(5);
  });

  it("外れ値1件で結論が変わらない（中央値を使う）", () => {
    const base = [item(100, 98), item(100, 101), item(100, 100), item(100, 102), item(100, 99)];
    expect(summarizeForecast(base).bias).toBe("BALANCED");
    // 1件だけ極端に高く売れても「低すぎる傾向」にはしない
    const withOutlier = [...base, item(100, 500)];
    expect(summarizeForecast(withOutlier).bias).toBe("BALANCED");
  });

  it(`${MIN_SAMPLES}件未満なら傾向として信用しない`, () => {
    const s = summarizeForecast([item(100, 80), item(100, 82)]);
    expect(s.count).toBe(2);
    expect(s.reliable).toBe(false);
    expect(s.bias).not.toBeNull(); // 値自体は出すが、信用フラグは立てない
  });

  it("利益の差は合計で出す", () => {
    const s = summarizeForecast([
      item(100, 80, 5000, 2000),
      item(100, 120, 5000, 8000),
    ]);
    expect(s.totalProfitDiffJpy).toBe(0);
  });

  it("1件も無ければ何も断定しない", () => {
    const s = summarizeForecast([]);
    expect(s.count).toBe(0);
    expect(s.bias).toBeNull();
    expect(s.medianPriceDiffPct).toBeNull();
    expect(s.reliable).toBe(false);
  });
});

describe("nextPredictedSellUsd（予想の固定）", () => {
  const call = (o: Partial<Parameters<typeof nextPredictedSellUsd>[0]>) =>
    nextPredictedSellUsd({
      current: 0,
      previousSellUsd: 0,
      nextSellUsd: 0,
      nextStatus: "STOCK",
      ...o,
    });

  it("仕入済のうちは固定しない（まだ売りに出していない）", () => {
    expect(call({ nextSellUsd: 100, nextStatus: "STOCK" })).toBe(0);
  });

  it("出品中にした時点で、その時の販売価格を予想として固定する", () => {
    expect(call({ previousSellUsd: 100, nextSellUsd: 100, nextStatus: "LISTED" })).toBe(100);
  });

  it("売却済にしつつ価格を実売額へ直しても、更新前の値を予想として残す", () => {
    // ここが肝。更新後の80を掴むと予想=実績になりズレが常に0になる。
    expect(call({ previousSellUsd: 100, nextSellUsd: 80, nextStatus: "SOLD" })).toBe(100);
  });

  it("一度固定したら上書きしない", () => {
    expect(call({ current: 100, previousSellUsd: 80, nextSellUsd: 60, nextStatus: "SOLD" })).toBe(100);
  });

  it("更新前の値が無ければ（新規で売却済など）更新後の値を使う", () => {
    expect(call({ previousSellUsd: 0, nextSellUsd: 80, nextStatus: "SOLD" })).toBe(80);
  });
});
