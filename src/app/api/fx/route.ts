// 為替レート取得の API ルート。
// GET /api/fx → { ok:true, rate, date, source } または { ok:false, error }
// クライアントの「現在レート取得」ボタンから呼ぶ。

import { fetchUsdJpyRate } from "@/lib/fx";

export async function GET(): Promise<Response> {
  const result = await fetchUsdJpyRate();
  return Response.json(result, {
    status: result.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
