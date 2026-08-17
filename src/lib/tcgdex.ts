// TCGdex API（日本語対応）クライアント。
// pokemontcg.io は英語DBのため、日本語のトレーナーズ/エネルギー等は
// TCGdex の日本語エンドポイントで検索する（カード名をそのまま日本語で検索できる）。
// 無料・APIキー不要。

import { logger } from "@/lib/logger";
import type { TcgCard, TcgSearchResult } from "@/lib/pokemontcg";

const BASE = "https://api.tcgdex.net/v2/ja/cards";
const TIMEOUT_MS = 8000;

/** 画像ベースURL → 実URL（TCGdex は末尾に画質と拡張子を付ける）。 */
function imageUrl(base: unknown, quality: "high" | "low"): string | null {
  return typeof base === "string" && base ? `${base}/${quality}.webp` : null;
}

/** TCGdex の一覧レスポンス（配列）を TcgCard[] に変換する純粋関数。 */
export function parseTcgdexList(json: unknown): TcgCard[] {
  if (!Array.isArray(json)) return [];
  const cards: TcgCard[] = [];
  for (const it of json) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    cards.push({
      id: o.id,
      name: o.name,
      number: typeof o.localId === "string" ? o.localId : typeof o.localId === "number" ? String(o.localId) : null,
      setName: null, // 一覧にはセット名が無いため空（詳細取得は省略）
      rarity: null,
      imageSmall: imageUrl(o.image, "low"),
      imageLarge: imageUrl(o.image, "high"),
    });
  }
  return cards;
}

/** TCGdex（日本語）でカード名検索する。 */
export async function searchTcgdexJa(query: string, limit = 12): Promise<TcgSearchResult> {
  const q = query.trim();
  if (!q) return { ok: true, cards: [] };

  const url = `${BASE}?name=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `カード情報API(TCGdex)がエラーを返しました (HTTP ${res.status})` };
    }
    const json = await res.json();
    return { ok: true, cards: parseTcgdexList(json).slice(0, limit) };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn("TCGdex 検索に失敗", err);
    return {
      ok: false,
      error: isAbort ? "カード情報API(TCGdex)がタイムアウトしました" : "カード情報(TCGdex)を取得できませんでした。",
    };
  } finally {
    clearTimeout(timer);
  }
}
