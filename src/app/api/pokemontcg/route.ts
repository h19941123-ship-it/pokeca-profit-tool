// Pokémon TCG カード情報検索の API ルート。
// GET /api/pokemontcg?q=<カード名（英語推奨）> → 候補カード一覧を返す。

import { searchTcgCards } from "@/lib/pokemontcg";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const langParam = url.searchParams.get("lang");
  const lang = langParam === "ja" || langParam === "en" ? langParam : undefined;
  if (!q) {
    return Response.json({ ok: false, error: "カード名を入力してください。" }, { status: 400 });
  }
  const result = await searchTcgCards(q, { lang });
  return Response.json(result, {
    status: result.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
