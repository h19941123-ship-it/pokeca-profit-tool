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
  it("最安・最高・平均・中央値・件数を集計", () => {
    const s = summarizeSold([
      { title: "a", priceValue: 80, currency: "USD", soldDate: null, url: null },
      { title: "b", priceValue: 100, currency: "USD", soldDate: null, url: null },
      { title: "c", priceValue: 120, currency: "USD", soldDate: null, url: null },
    ]);
    expect(s).toEqual({ count: 3, min: 80, max: 120, avg: 100, median: 100, currency: "USD", skipped: 0 });
  });

  it("空なら null", () => {
    expect(summarizeSold([])).toBeNull();
  });

  it("通貨が混ざったら多数派だけで集計する", () => {
    // eBay は marketplace を指定しても出品者の通貨で返すことがある。
    // 以前は先頭の通貨を代表に全件を平均していて、USD 2件に 15,000円が
    // 1件混ざるだけで「平均 $5,060」になっていた。
    const s = summarizeSold([
      { title: "a", priceValue: 80, currency: "USD", soldDate: null, url: null },
      { title: "b", priceValue: 100, currency: "USD", soldDate: null, url: null },
      { title: "c", priceValue: 15000, currency: "JPY", soldDate: null, url: null },
    ])!;
    expect(s.currency).toBe("USD");
    expect(s.count).toBe(2);
    expect(s.avg).toBe(90);
    expect(s.max).toBe(100);
    expect(s.skipped).toBe(1);
  });
});
