import { describe, it, expect } from "vitest";
import { parseSoldItems, summarizeSold } from "./ebayInsights";

describe("parseSoldItems", () => {
  it("item_sales/search のレスポンスから落札実績を取り出す", () => {
    const json = {
      itemSales: [
        { title: "Charizard ex", lastSoldPrice: { value: "85.00", currency: "USD" }, lastSoldDate: "2026-08-01T00:00:00Z", itemWebUrl: "https://ebay.com/1" },
        { title: "Charizard ex PSA10", lastSoldPrice: { value: "300", currency: "USD" }, lastSoldDate: "2026-08-05T00:00:00Z" },
      ],
    };
    const items = parseSoldItems(json);
    expect(items).toHaveLength(2);
    expect(items[0].priceValue).toBe(85);
    expect(items[0].soldDate).toBe("2026-08-01T00:00:00Z");
    expect(items[1].priceValue).toBe(300);
  });

  it("価格が数値にならない項目は除外", () => {
    expect(parseSoldItems({ itemSales: [{ title: "x", lastSoldPrice: { value: "-" } }] })).toHaveLength(0);
  });

  it("itemSales が無ければ空配列", () => {
    expect(parseSoldItems({})).toEqual([]);
    expect(parseSoldItems(null)).toEqual([]);
  });
});

describe("summarizeSold", () => {
  it("最安・最高・平均・件数を集計", () => {
    const s = summarizeSold([
      { title: "a", priceValue: 80, currency: "USD", soldDate: null, url: null },
      { title: "b", priceValue: 100, currency: "USD", soldDate: null, url: null },
      { title: "c", priceValue: 120, currency: "USD", soldDate: null, url: null },
    ]);
    expect(s).toEqual({ count: 3, min: 80, max: 120, avg: 100, currency: "USD" });
  });

  it("空なら null", () => {
    expect(summarizeSold([])).toBeNull();
  });
});
