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
import { logger } from "@/lib/logger";

const HEADERS = [
  "カード名",
  "カード番号",
  "セット",
  "レアリティ",
  "言語",
  "コンディション",
  "仕入価格(円)",
  "仕入先",
  "国内買取額(円)",
  "購入日",
  "在庫",
  "販売価格(USD)",
  "購入者請求送料(USD)",
  "為替(円/USD)",
  "予想売上(円)",
  "eBay手数料(円)",
  "決済手数料(円)",
  "為替手数料(円)",
  "関税(円)",
  "送料(円)",
  "梱包費(円)",
  "その他(円)",
  "予想利益(円)",
  "利益率(%)",
  "仕入れ判定",
  "おすすめ度",
  // --- PSA鑑定シミュレーション ---
  "鑑定プラン",
  "PSA10価格(USD)",
  "PSA9以下価格(USD)",
  "PSA10確率(%)",
  "鑑定コスト計(円)",
  "鑑定_期待利益(円)",
  "鑑定_期待利益率(%)",
  "鑑定推奨",
];

/** 鑑定プランの日本語ラベル。 */
const PLAN_JP: Record<string, string> = { REGULAR: "レギュラー", EXPRESS: "エクスプレス" };

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

    const dataRows = rows.map(({ card, profit, fxRate, grading }) => [
      card.name,
      card.cardNumber,
      card.setName,
      card.rarity,
      card.language,
      card.condition,
      card.purchasePriceJpy,
      card.supplier,
      card.domesticBuybackJpy,
      ymd(card.purchasedAt),
      card.stock,
      card.sellPriceUsd,
      card.shippingChargedUsd,
      fxRate,
      profit.revenueJpy,
      profit.fees.ebayJpy,
      profit.fees.paymentJpy,
      profit.fees.fxJpy,
      profit.fees.tariffJpy,
      profit.fees.shippingJpy,
      profit.fees.packingJpy,
      profit.fees.otherJpy,
      profit.profitJpy,
      profit.profitRate === null ? "" : profit.profitRate,
      profit.decisionLabel,
      profit.score,
      // 鑑定シミュレーション（未設定なら空欄）
      PLAN_JP[card.gradingPlan] ?? card.gradingPlan,
      card.psa10SellUsd,
      card.psa9SellUsd,
      card.psa10Prob,
      grading.configured ? grading.gradingTotalJpy : "",
      grading.configured ? grading.expectedProfitJpy : "",
      grading.configured && grading.expectedProfitRate !== null ? grading.expectedProfitRate : "",
      grading.configured ? (grading.worthGrading ? "推奨" : "非推奨") : "",
    ]);

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
