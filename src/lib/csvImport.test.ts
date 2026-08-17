import { describe, it, expect } from "vitest";
import { parseImportText } from "@/lib/csvImport";

describe("parseImportText", () => {
  it("カンマ区切りを解釈する", () => {
    const r = parseImportText("リザードンex,3000,120,黒炎,25/108,SAR,駿河屋,強気");
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({
      name: "リザードンex",
      purchasePriceJpy: 3000,
      sellPriceUsd: 120,
      setName: "黒炎",
      cardNumber: "25/108",
      rarity: "SAR",
      supplier: "駿河屋",
      tags: "強気",
    });
  });

  it("タブ区切り（スプレッドシート貼り付け）を解釈する", () => {
    const r = parseImportText("ミュウex\t1500\t60");
    expect(r.cards[0]).toMatchObject({ name: "ミュウex", purchasePriceJpy: 1500, sellPriceUsd: 60 });
    expect(r.cards[0].setName).toBeNull();
  });

  it("ヘッダー行をスキップする", () => {
    const r = parseImportText("カード名,仕入,販売\nピカチュウ,100,5");
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].name).toBe("ピカチュウ");
  });

  it("名前が空の行はスキップする", () => {
    const r = parseImportText("ok,1,1\n,2,2\n   ,3,3");
    expect(r.cards).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it("クオート内のカンマを保持する", () => {
    const r = parseImportText('"リザードン, ex",3000,120');
    expect(r.cards[0].name).toBe("リザードン, ex");
    expect(r.cards[0].purchasePriceJpy).toBe(3000);
  });

  it("空文字は空の結果", () => {
    expect(parseImportText("   ").cards).toHaveLength(0);
  });
});
