import { describe, it, expect } from "vitest";
import { isFxStale } from "@/lib/fxAuto";

describe("isFxStale", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  it("未更新（null）なら常に stale", () => {
    expect(isFxStale(null, now)).toBe(true);
  });

  it("12時間未満なら stale ではない", () => {
    const last = new Date(now.getTime() - 11 * 60 * 60 * 1000);
    expect(isFxStale(last, now)).toBe(false);
  });

  it("12時間以上なら stale", () => {
    const last = new Date(now.getTime() - 13 * 60 * 60 * 1000);
    expect(isFxStale(last, now)).toBe(true);
  });

  it("最小間隔を指定できる", () => {
    const last = new Date(now.getTime() - 2 * 60 * 1000);
    expect(isFxStale(last, now, 60 * 1000)).toBe(true);
    expect(isFxStale(last, now, 5 * 60 * 1000)).toBe(false);
  });
});
