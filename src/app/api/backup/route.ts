// 全データ（カード＋設定）を JSON でバックアップ出力する。
// GET /api/backup → pokeca_backup_YYYY-MM-DD.json

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ymd } from "@/lib/format";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    const [cards, settings] = await Promise.all([
      prisma.card.findMany({ orderBy: { id: "asc" } }),
      getSettings(),
    ]);
    const backup = {
      app: "pokeca-profit-tool",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      cards,
    };
    const json = JSON.stringify(backup, null, 2);
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pokeca_backup_${ymd(new Date())}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error("バックアップ出力に失敗", err);
    return new Response("バックアップの生成に失敗しました。", { status: 500 });
  }
}
