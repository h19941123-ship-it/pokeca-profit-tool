// CSV エクスポートのルートハンドラ。
// 現在の検索条件・並び順を反映して、カード情報＋利益分析を CSV で返す。
// 例: GET /api/export?decision=BUY&sort=profitJpy&dir=desc

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  buildRows,
  sortRows,
  toSortKey,
  toSortDir,
} from "@/lib/dashboard";
import {
  parseFilters,
  buildWhere,
  applyComputedFilters,
} from "@/lib/search";
import { toCsv } from "@/lib/csv";
import { ymd } from "@/lib/format";
import { HEADERS, buildExportRow } from "@/lib/exportCsv";
import { logger } from "@/lib/logger";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sp = Object.fromEntries(url.searchParams.entries());
    const filters = parseFilters(sp);
    const sortKey = toSortKey(sp.sort);
    const sortDir = toSortDir(sp.dir);

    const [cards, settings] = await Promise.all([
      prisma.card.findMany({ where: buildWhere(filters) }),
      getSettings(),
    ]);
    const rows = sortRows(
      applyComputedFilters(buildRows(cards, settings), filters),
      sortKey,
      sortDir,
    );

    const dataRows = rows.map((r) => buildExportRow(r, settings));

    const csv = toCsv(HEADERS, dataRows);
    const filename = `pokeca_export_${ymd(new Date())}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error("CSVエクスポートに失敗", err);
    return new Response("CSVの生成に失敗しました。", { status: 500 });
  }
}
