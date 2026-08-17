import { describe, it, expect } from "vitest";
import { translateCardQuery, hasJapanese } from "./jpPokemonNames";

describe("translateCardQuery", () => {
  it("日本語の種族名を英語に変換（ex/SARは残す）", () => {
    const r = translateCardQuery("リザードンex SAR");
    expect(r.translated).toBe("Charizard ex SAR");
    expect(r.didTranslate).toBe(true);
  });

  it("種族名のみでも変換", () => {
    expect(translateCardQuery("ピカチュウ").translated).toBe("Pikachu");
  });

  it("長い名前を優先（リザードン > リザード）", () => {
    expect(translateCardQuery("リザードン").translated).toBe("Charizard");
    expect(translateCardQuery("リザード").translated).toBe("Charmeleon");
  });

  it("進化系イーブイズも変換", () => {
    expect(translateCardQuery("ブラッキーV").translated).toBe("Umbreon V");
  });

  it("英語クエリはそのまま（didTranslate=false）", () => {
    const r = translateCardQuery("Charizard ex");
    expect(r.translated).toBe("Charizard ex");
    expect(r.didTranslate).toBe(false);
  });

  it("未収録の日本語はそのまま残る", () => {
    // 収録していない語は変換されない
    const r = translateCardQuery("よくわからないカード");
    expect(r.didTranslate).toBe(false);
  });
});

describe("hasJapanese", () => {
  it("日本語を検出", () => {
    expect(hasJapanese("リザードン")).toBe(true);
    expect(hasJapanese("Charizard")).toBe(false);
  });
});
