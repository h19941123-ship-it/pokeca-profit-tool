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

describe("画像URL列（9列目）", () => {
  it("画像URLを読み取る", () => {
    const r = parseImportText(
      "リザードンex,5000,120,151,201/165,SAR,駿河屋,高額,https://example.com/a.webp",
    );
    expect(r.cards[0].imageUrl).toBe("https://example.com/a.webp");
  });

  it("省略しても落ちない（従来の8列のまま使える）", () => {
    const r = parseImportText("リザードンex,5000,120,151,201/165,SAR,駿河屋,高額");
    expect(r.cards[0].imageUrl).toBeNull();
    expect(r.cards[0].tags).toBe("高額");
  });

  it("空欄なら null", () => {
    const r = parseImportText("リザードンex,5000,120,,,,,,");
    expect(r.cards[0].imageUrl).toBeNull();
  });

  it("タブ区切りでも読める", () => {
    const r = parseImportText(
      "リザードンex\t5000\t120\t151\t201/165\tSAR\t駿河屋\t高額\thttps://example.com/b.webp",
    );
    expect(r.cards[0].imageUrl).toBe("https://example.com/b.webp");
  });
});
