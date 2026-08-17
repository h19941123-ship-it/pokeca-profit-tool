// Pokémon TCG API（pokemontcg.io）からカード情報を取得する。
// 無料・APIキー不要（POKEMONTCG_API_KEY を設定すると上限が緩和される）。
// ※ 英語カードDBのため、検索は英語名（例: Charizard）が有効。
//   Japanese 名では一致しにくい点に注意。

import { logger } from "@/lib/logger";
import { translateCardQuery, hasJapanese } from "@/lib/jpPokemonNames";
import { searchTcgdexJa } from "@/lib/tcgdex";

const BASE = "https://api.pokemontcg.io/v2/cards";
const TIMEOUT_MS = 8000;

/** 正規化したカード情報（画面表示・フォーム反映用）。 */
export interface TcgCard {
  id: string;
  name: string;
  number: string | null;
  setName: string | null;
  rarity: string | null;
  imageSmall: string | null; // 一覧サムネイル用
  imageLarge: string | null; // 反映して保存する画像URL
}

export type TcgSearchResult =
  | { ok: true; cards: TcgCard[] }
  | { ok: false; error: string };

/** APIレスポンスJSONから TcgCard[] を取り出す純粋関数。 */
export function parseTcgCards(json: unknown): TcgCard[] {
  if (typeof json !== "object" || json === null) return [];
  const data = (json as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  const cards: TcgCard[] = [];
  for (const it of data) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    const set = o.set as Record<string, unknown> | undefined;
    const images = o.images as Record<string, unknown> | undefined;
    cards.push({
      id: o.id,
      name: o.name,
      number: typeof o.number === "string" ? o.number : null,
      setName: set && typeof set.name === "string" ? set.name : null,
      rarity: typeof o.rarity === "string" ? o.rarity : null,
      imageSmall: images && typeof images.small === "string" ? images.small : null,
      imageLarge: images && typeof images.large === "string" ? images.large : null,
    });
  }
  return cards;
}

/** pokemontcg.io（英語DB）を検索する内部ヘルパー。 */
async function pokemontcgSearch(englishQuery: string, limit: number): Promise<TcgSearchResult> {
  const nameQuery = `name:"${englishQuery.replace(/"/g, "")}*"`;
  const url = `${BASE}?q=${encodeURIComponent(nameQuery)}&pageSize=${Math.min(Math.max(limit, 1), 50)}&orderBy=-set.releaseDate`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `カード情報APIがエラーを返しました (HTTP ${res.status})` };
    const json = await res.json();
    return { ok: true, cards: parseTcgCards(json) };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn("pokemontcg 検索に失敗", err);
    return {
      ok: false,
      error: isAbort ? "カード情報APIがタイムアウトしました" : "カード情報を取得できませんでした（ネットワークをご確認ください）",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * カード名で検索する。
 *  - lang="ja" … TCGdex 日本語（全カード種別・日本語名で一貫）
 *  - lang="en" … pokemontcg.io（英語名・高精細画像。日本語ポケモン名は英語変換）
 *  - 未指定    … 従来の自動判定（ポケモン=英語DB、変換不可=日本語DB、失敗時フォールバック）
 */
export async function searchTcgCards(
  query: string,
  opts: { limit?: number; lang?: "ja" | "en" } = {},
): Promise<TcgSearchResult> {
  const limit = opts.limit ?? 12;
  const raw = query.trim();
  if (!raw) return { ok: true, cards: [] };

  // 言語を明示指定 → その1ソースに固定（結果が一貫する）
  if (opts.lang === "ja") return searchTcgdexJa(raw, limit);
  if (opts.lang === "en") {
    const { translated, didTranslate } = translateCardQuery(raw);
    return pokemontcgSearch(didTranslate ? translated : raw, limit);
  }

  // 未指定 → 自動判定
  const jp = hasJapanese(raw);
  const { translated, didTranslate } = translateCardQuery(raw);
  if (jp && !didTranslate) return searchTcgdexJa(raw, limit);

  const result = await pokemontcgSearch(didTranslate ? translated : raw, limit);
  if (jp && (!result.ok || result.cards.length === 0)) {
    const alt = await searchTcgdexJa(raw, limit);
    if (alt.ok && alt.cards.length > 0) return alt;
  }
  return result;
}
