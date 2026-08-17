import { describe, it, expect } from "vitest";
import { extractJpyRate } from "./fx";

describe("extractJpyRate", () => {
  it("正常なレスポンスからレートと日付を取り出す", () => {
    const r = extractJpyRate({ amount: 1, base: "USD", date: "2026-08-12", rates: { JPY: 150.23 } });
    expect(r).toEqual({ rate: 150.23, date: "2026-08-12" });
  });

  it("rates.JPY が無ければ null", () => {
    expect(extractJpyRate({ date: "2026-08-12", rates: { EUR: 0.9 } })).toBeNull();
  });

  it("JPY が数値でなければ null", () => {
    expect(extractJpyRate({ rates: { JPY: "150" } })).toBeNull();
  });

  it("0 以下のレートは null", () => {
    expect(extractJpyRate({ rates: { JPY: 0 } })).toBeNull();
  });

  it("非オブジェクト・null は null", () => {
    expect(extractJpyRate(null)).toBeNull();
    expect(extractJpyRate("x")).toBeNull();
    expect(extractJpyRate(undefined)).toBeNull();
  });

  it("date が無くても rate があれば取得（date は空文字）", () => {
    expect(extractJpyRate({ rates: { JPY: 149 } })).toEqual({ rate: 149, date: "" });
  });
});
