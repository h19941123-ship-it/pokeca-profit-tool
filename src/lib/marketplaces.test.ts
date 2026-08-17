import { describe, it, expect } from "vitest";
import { isValidMarketplace, toMarketplaceId, getMarketplace, DEFAULT_MARKETPLACE_ID } from "./marketplaces";

describe("marketplaces", () => {
  it("有効なIDを判定", () => {
    expect(isValidMarketplace("EBAY_US")).toBe(true);
    expect(isValidMarketplace("EBAY_GB")).toBe(true);
    expect(isValidMarketplace("EBAY_XX")).toBe(false);
    expect(isValidMarketplace(null)).toBe(false);
  });

  it("不正なIDは既定に正規化", () => {
    expect(toMarketplaceId("EBAY_DE")).toBe("EBAY_DE");
    expect(toMarketplaceId("bad")).toBe(DEFAULT_MARKETPLACE_ID);
    expect(toMarketplaceId(undefined)).toBe(DEFAULT_MARKETPLACE_ID);
  });

  it("定義を取得", () => {
    expect(getMarketplace("EBAY_US")?.currency).toBe("USD");
    expect(getMarketplace("EBAY_GB")?.currency).toBe("GBP");
    expect(getMarketplace("nope")).toBeUndefined();
  });
});
