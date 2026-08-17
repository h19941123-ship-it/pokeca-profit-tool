// eBay 出品価格検索の API ルート。
// GET /api/ebay?q=<キーワード> → 出品中の価格の集計＋サンプル出品を返す。
// 認証情報が無い場合は reason: "no_credentials" を返し、画面が案内を出す。

import { searchActiveListings } from "@/lib/ebay";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const marketplace = url.searchParams.get("marketplace") ?? undefined;
  if (!q) {
    return Response.json(
      { ok: false, reason: "error", error: "検索キーワードを入力してください。" },
      { status: 400 },
    );
  }

  const result = await searchActiveListings(q, { marketplace });
  const status = result.ok ? 200 : result.reason === "no_credentials" ? 200 : 502;
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
