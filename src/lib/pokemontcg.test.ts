import { describe, it, expect } from "vitest";
import { parseTcgCards } from "./pokemontcg";

describe("parseTcgCards", () => {
  it("APIレスポンスからカード情報を取り出す", () => {
    const json = {
      data: [
        {
          id: "sv3pt5-6",
          name: "Charizard ex",
          number: "6",
          rarity: "Double Rare",
          set: { name: "151" },
          images: { small: "https://img/small.png", large: "https://img/large.png" },
        },
      ],
    };
    const cards = parseTcgCards(json);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      id: "sv3pt5-6",
      name: "Charizard ex",
      number: "6",
      setName: "151",
      rarity: "Double Rare",
      imageSmall: "https://img/small.png",
      imageLarge: "https://img/large.png",
    });
  });

  it("id/name が無い項目は除外", () => {
    expect(parseTcgCards({ data: [{ number: "1" }] })).toHaveLength(0);
  });

  it("画像やセットが無くても取得（null で埋める）", () => {
    const cards = parseTcgCards({ data: [{ id: "x", name: "Pikachu" }] });
    expect(cards[0].setName).toBeNull();
    expect(cards[0].imageLarge).toBeNull();
  });

  it("data が無ければ空配列", () => {
    expect(parseTcgCards({})).toEqual([]);
    expect(parseTcgCards(null)).toEqual([]);
  });
});
