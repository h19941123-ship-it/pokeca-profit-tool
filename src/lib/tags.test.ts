import { describe, it, expect } from "vitest";
import { splitTags } from "@/lib/tags";

describe("splitTags", () => {
  it("未入力は空配列", () => {
    expect(splitTags(null)).toEqual([]);
    expect(splitTags("")).toEqual([]);
    expect(splitTags("  ")).toEqual([]);
  });

  it("半角カンマで分割し前後の空白を落とす", () => {
    expect(splitTags("151, 高額 ,カードラッシュ")).toEqual([
      "151",
      "高額",
      "カードラッシュ",
    ]);
  });

  it("全角カンマ・読点でも分割する", () => {
    expect(splitTags("151、高額，SAR")).toEqual(["151", "高額", "SAR"]);
  });

  it("重複と空要素を除去する", () => {
    expect(splitTags("高額,,高額, 151")).toEqual(["高額", "151"]);
  });
});
