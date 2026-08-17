import { describe, it, expect } from "vitest";
import { buildEbaySearchUrl } from "@/lib/ebayLink";

describe("buildEbaySearchUrl", () => {
  it("US 出品中: ドメイン・カテゴリ・検索語を含む", () => {
    const url = buildEbaySearchUrl("Charizard ex", { marketplace: "EBAY_US" });
    expect(url).toContain("https://www.ebay.com/sch/i.html?");
    expect(url).toContain("_nkw=Charizard+ex");
    expect(url).toContain("_sacat=183454");
    expect(url).not.toContain("LH_Sold");
  });

  it("売却済: LH_Sold と LH_Complete を付ける", () => {
    const url = buildEbaySearchUrl("Pikachu", { sold: true });
    expect(url).toContain("LH_Sold=1");
    expect(url).toContain("LH_Complete=1");
  });

  it("英国ドメインはカテゴリを付けない", () => {
    const url = buildEbaySearchUrl("Mew ex", { marketplace: "EBAY_GB" });
    expect(url).toContain("https://www.ebay.co.uk/sch/i.html?");
    expect(url).not.toContain("_sacat");
  });

  it("不正なマーケットは US にフォールバック", () => {
    const url = buildEbaySearchUrl("Snorlax", { marketplace: "EBAY_ZZ" });
    expect(url).toContain("www.ebay.com");
  });

  it("空クエリは null", () => {
    expect(buildEbaySearchUrl("   ")).toBeNull();
    expect(buildEbaySearchUrl("")).toBeNull();
  });

  it("特殊文字をURLエンコードする", () => {
    const url = buildEbaySearchUrl("リザードン & ex #123");
    expect(url).toContain("%26"); // &
    expect(url).toContain("%23"); // #
    expect(url).not.toMatch(/[ #&](?!\w)/); // 生の区切り文字が残らない
  });
});
