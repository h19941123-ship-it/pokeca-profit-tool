import { describe, it, expect } from "vitest";
import { parseTcgdexList } from "./tcgdex";

describe("parseTcgdexList", () => {
  it("TCGdex一覧レスポンスを TcgCard[] に変換（画像URLを組み立て）", () => {
    const json = [
      { id: "SVLN-014", localId: "014", name: "ハイパーボール", image: "https://assets.tcgdex.net/ja/SV/SVLN/014" },
      { id: "SV1a-100", localId: 100, name: "基本炎エネルギー" }, // 画像なし・localId数値
    ];
    const cards = parseTcgdexList(json);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      id: "SVLN-014",
      name: "ハイパーボール",
      number: "014",
      setName: null,
      rarity: null,
      imageSmall: "https://assets.tcgdex.net/ja/SV/SVLN/014/low.webp",
      imageLarge: "https://assets.tcgdex.net/ja/SV/SVLN/014/high.webp",
    });
    expect(cards[1].number).toBe("100");
    expect(cards[1].imageLarge).toBeNull(); // 画像なし
  });

  it("配列でなければ空", () => {
    expect(parseTcgdexList({})).toEqual([]);
    expect(parseTcgdexList(null)).toEqual([]);
  });

  it("id/name が無い項目は除外", () => {
    expect(parseTcgdexList([{ localId: "1" }])).toHaveLength(0);
  });
});
