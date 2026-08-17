// eBay 実売価格（落札実績）検索の API ルート。
// GET /api/ebay/sold?q=<キーワード>
// 認証なし → no_credentials / 申請未承認 → not_approved を返し、画面が案内する。

import { searchSoldItems } from "@/lib/ebayInsights";

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

  const result = await searchSoldItems(q, { marketplace });
  // no_credentials / not_approved は「案内」なので 200 で返す
  const status =
    result.ok || result.reason === "no_credentials" || result.reason === "not_approved"
      ? 200
      : 502;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
