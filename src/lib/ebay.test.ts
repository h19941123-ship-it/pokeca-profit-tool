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
  it("最安・最高・平均・中央値・件数を集計", () => {
    const s = summarizePrices([
      { title: "a", priceValue: 80, currency: "USD", condition: null, url: null },
      { title: "b", priceValue: 120, currency: "USD", condition: null, url: null },
      { title: "c", priceValue: 100, currency: "USD", condition: null, url: null },
    ]);
    expect(s).toEqual({ count: 3, min: 80, max: 120, avg: 100, median: 100, currency: "USD", skipped: 0 });
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

describe("summarizePrices の中央値", () => {
  const listing = (priceValue: number) => ({
    title: "t",
    priceValue,
    currency: "USD",
    condition: null,
    url: null,
  });

  it("奇数個は真ん中の値", () => {
    const s = summarizePrices([10, 20, 100].map(listing))!;
    expect(s.median).toBe(20);
  });

  it("偶数個は中央2つの平均", () => {
    const s = summarizePrices([10, 20, 30, 100].map(listing))!;
    expect(s.median).toBe(25);
  });

  it("並び順に依存しない", () => {
    const a = summarizePrices([100, 10, 30, 20].map(listing))!;
    const b = summarizePrices([10, 20, 30, 100].map(listing))!;
    expect(a.median).toBe(b.median);
  });

  it("極端な安値の外れ値に引きずられない（最安・平均との違い）", () => {
    // 実データ例: 最安$29.84 は状態の悪い品で、相場の目安にならない
    const prices = [29.84, 176, 270, 300, 370, 400, 410, 440, 550, 690];
    const s = summarizePrices(prices.map(listing))!;
    expect(s.min).toBe(29.84); // 最安は外れ値のまま
    expect(s.median).toBe(385); // 中央値は現実的な水準
    expect(s.median).toBeGreaterThan(s.min * 5);
  });

  it("1件でも落ちない", () => {
    expect(summarizePrices([listing(42)])!.median).toBe(42);
  });

  it("通貨が混ざったら多数派だけで集計する", () => {
    // eBay は marketplace を指定しても出品者の通貨で返すことがある。
    // 以前は先頭の通貨を代表に全件を平均していて、USD 2件に 15,000円が
    // 1件混ざるだけで「平均 $5,060」になっていた。
    const s = summarizePrices([
      { title: "a", priceValue: 80, currency: "USD", condition: null, url: null },
      { title: "b", priceValue: 100, currency: "USD", condition: null, url: null },
      { title: "c", priceValue: 15000, currency: "JPY", condition: null, url: null },
    ])!;
    expect(s.currency).toBe("USD");
    expect(s.count).toBe(2);
    expect(s.avg).toBe(90);
    expect(s.max).toBe(100);
    expect(s.skipped).toBe(1);
  });
});
