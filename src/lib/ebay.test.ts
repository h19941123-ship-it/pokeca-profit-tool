import { describe, it, expect } from "vitest";
import { parseListings, summarizePrices } from "./ebay";

describe("parseListings", () => {
  it("Browse API のレスポンスから出品を取り出す", () => {
    const json = {
      itemSummaries: [
        { title: "Charizard ex", price: { value: "80.00", currency: "USD" }, condition: "Ungraded", itemWebUrl: "https://ebay.com/1" },
        { title: "Charizard ex PSA10", price: { value: "250.5", currency: "USD" }, itemWebUrl: "https://ebay.com/2" },
      ],
    };
    const listings = parseListings(json);
    expect(listings).toHaveLength(2);
    expect(listings[0].priceValue).toBe(80);
    expect(listings[0].currency).toBe("USD");
    expect(listings[1].priceValue).toBe(250.5);
  });

  it("価格が数値にならない項目は除外", () => {
    const json = { itemSummaries: [{ title: "x", price: { value: "N/A" } }] };
    expect(parseListings(json)).toHaveLength(0);
  });

  it("itemSummaries が無ければ空配列", () => {
    expect(parseListings({})).toEqual([]);
    expect(parseListings(null)).toEqual([]);
  });
});

describe("summarizePrices", () => {
  it("最安・最高・平均・件数を集計", () => {
    const s = summarizePrices([
      { title: "a", priceValue: 80, currency: "USD", condition: null, url: null },
      { title: "b", priceValue: 120, currency: "USD", condition: null, url: null },
      { title: "c", priceValue: 100, currency: "USD", condition: null, url: null },
    ]);
    expect(s).toEqual({ count: 3, min: 80, max: 120, avg: 100, currency: "USD" });
  });

  it("空なら null", () => {
    expect(summarizePrices([])).toBeNull();
  });

  it("平均は小数第2位に丸める", () => {
    const s = summarizePrices([
      { title: "a", priceValue: 10, currency: "USD", condition: null, url: null },
      { title: "b", priceValue: 10, currency: "USD", condition: null, url: null },
      { title: "c", priceValue: 11, currency: "USD", condition: null, url: null },
    ]);
    expect(s?.avg).toBe(10.33);
  });
});
