import { describe, it, expect } from "vitest";
import { isDue, MIN_INTERVAL_MS } from "./watchCollect";

const NOW = new Date("2026-08-21T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe("isDue（取り直す時期か）", () => {
  it("一度も記録が無ければ対象", () => {
    expect(isDue(null, NOW)).toBe(true);
  });

  it("間隔が空いていなければ取りに行かない（eBayを叩きすぎない）", () => {
    expect(isDue(hoursAgo(1), NOW)).toBe(false);
    expect(isDue(hoursAgo(5), NOW)).toBe(false);
  });

  it("間隔を過ぎていれば対象", () => {
    expect(isDue(hoursAgo(6), NOW)).toBe(true);
    expect(isDue(hoursAgo(48), NOW)).toBe(true);
  });

  it("ちょうど境界は対象に含める", () => {
    expect(isDue(new Date(NOW.getTime() - MIN_INTERVAL_MS), NOW)).toBe(true);
  });
});

describe("観測値の通貨", () => {
  it("US以外のマーケットの値を $ で出さない", async () => {
    const { money } = await import("@/lib/format");
    // 列名は medianUsd だが、UK を監視すれば GBP で記録される。
    // 以前はここも一律 $ で表示していて、£120 が $120 に見えていた。
    expect(money(120, "USD")).toBe("$120");
    expect(money(120, "GBP")).toBe("120 GBP");
    expect(money(1500, "EUR")).toBe("1,500 EUR");
  });
});
