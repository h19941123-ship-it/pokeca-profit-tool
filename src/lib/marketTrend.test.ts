import { describe, it, expect } from "vitest";
import { analyzeTrend, type TrendSample } from "./marketTrend";

const NOW = new Date("2026-08-21T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const s = (days: number, medianUsd: number, listingCount: number): TrendSample => ({
  observedAt: daysAgo(days),
  medianUsd,
  listingCount,
});

const run = (samples: TrendSample[]) => analyzeTrend(samples, { now: NOW });

describe("analyzeTrend", () => {
  it("記録が片側しか無ければ判定しない", () => {
    expect(run([s(1, 100, 20), s(2, 100, 20)]).signal).toBe("INSUFFICIENT");
    expect(run([]).signal).toBe("INSUFFICIENT");
  });

  it("値上がり＋出品減 → 買われている", () => {
    const r = run([
      s(10, 100, 40), s(8, 100, 38),   // 過去
      s(1, 130, 25), s(0, 130, 24),    // 直近
    ]);
    expect(r.signal).toBe("HEATING");
    expect(r.priceChangePct).toBeCloseTo(30);
    expect(r.countChangePct).toBeLessThan(0);
  });

  it("値上がりしても出品が増えていれば「値上がり」止まり（売り手が強気なだけかもしれない）", () => {
    const r = run([
      s(10, 100, 20), s(8, 100, 20),
      s(1, 130, 40), s(0, 130, 40),
    ]);
    expect(r.signal).toBe("RISING");
  });

  it("出品件数が横ばいでも「買われている」とは言わない", () => {
    const r = run([
      s(10, 100, 30), s(8, 100, 30),
      s(1, 130, 30), s(0, 130, 30),
    ]);
    expect(r.signal).toBe("RISING");
  });

  it("値下がりを検出する", () => {
    expect(run([s(10, 130, 20), s(8, 130, 20), s(1, 100, 20), s(0, 100, 20)]).signal).toBe("FALLING");
  });

  it("しきい値未満の動きは横ばい", () => {
    expect(run([s(10, 100, 20), s(8, 100, 20), s(1, 105, 20), s(0, 105, 20)]).signal).toBe("FLAT");
  });

  it("1回の外れ値で結論が変わらない（期間内の中央値で比べる）", () => {
    // 直近3件のうち1件だけ極端に高い
    const r = run([
      s(10, 100, 20), s(9, 100, 20), s(8, 100, 20),
      s(2, 100, 20), s(1, 300, 20), s(0, 100, 20),
    ]);
    expect(r.signal).toBe("FLAT");
  });

  it("比較範囲より古い記録は使わない", () => {
    // 30日前の安値は lookback(14日) の外なので無視され、比較材料が無くなる
    const r = run([s(30, 50, 20), s(1, 100, 20)]);
    expect(r.signal).toBe("INSUFFICIENT");
    expect(r.used.base).toBe(0);
  });

  it("判定に使った件数を返す（少なければ画面で断れる）", () => {
    const r = run([s(10, 100, 20), s(1, 100, 20)]);
    expect(r.used).toEqual({ recent: 1, base: 1 });
  });

  it("過去の中央値が0なら比べない（ゼロ割りを避ける）", () => {
    expect(run([s(10, 0, 0), s(1, 100, 20)]).signal).toBe("INSUFFICIENT");
  });

  it("しきい値は変えられる", () => {
    const samples = [s(10, 100, 20), s(1, 105, 20)];
    expect(analyzeTrend(samples, { now: NOW, risePct: 3 }).signal).toBe("RISING");
    expect(analyzeTrend(samples, { now: NOW, risePct: 20 }).signal).toBe("FLAT");
  });
});
