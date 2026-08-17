import { describe, it, expect } from "vitest";
import { parseCardForm } from "./validation";

/** テスト用に FormData を組み立てる。 */
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parseCardForm", () => {
  it("正常系: 必須＋数値変換＋任意項目の既定値", () => {
    const r = parseCardForm(fd({ name: "ピカチュウ", purchasePriceJpy: "5000", sellPriceUsd: "80" }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("ピカチュウ");
      expect(r.data.purchasePriceJpy).toBe(5000);
      expect(r.data.sellPriceUsd).toBe(80);
      expect(r.data.language).toBe("JP"); // 既定値
      expect(r.data.condition).toBe("NM"); // 既定値
      expect(r.data.stock).toBe(1); // 空欄 → 既定1
      expect(r.data.shippingJpy).toBe(0); // 空欄 → 既定0
      expect(r.data.fxRate).toBeUndefined(); // 空欄 → 未指定（設定既定を使う）
    }
  });

  it("カード名が空 → エラー", () => {
    const r = parseCardForm(fd({ name: "", purchasePriceJpy: "5000" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.name).toBeTruthy();
  });

  it("仕入れ価格が数値でない → エラー", () => {
    const r = parseCardForm(fd({ name: "x", purchasePriceJpy: "abc" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.purchasePriceJpy).toBeTruthy();
  });

  it("仕入れ価格が負 → エラー", () => {
    const r = parseCardForm(fd({ name: "x", purchasePriceJpy: "-100" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.purchasePriceJpy).toBeTruthy();
  });

  it("画像URLが不正な形式 → エラー", () => {
    const r = parseCardForm(fd({ name: "x", purchasePriceJpy: "100", imageUrl: "not-a-url" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.imageUrl).toBeTruthy();
  });

  it("空白のみのカード名 → トリムされてエラー", () => {
    const r = parseCardForm(fd({ name: "   ", purchasePriceJpy: "100" }));
    expect(r.success).toBe(false);
  });
});
