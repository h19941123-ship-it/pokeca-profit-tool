// CSV エクスポートの列定義と行の組み立て。
//
// ルートハンドラから分けてあるのは、ヘッダーと行の列数が一致することを
// テストで機械的に確かめるため。列を1つ足し忘れると以降の値が全部
// 隣の列にずれるが、CSV は開くまで気づけない。

import type { Settings } from "@/generated/prisma/client";
import type { CardRow } from "@/lib/dashboard";
import { ymd } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { buildForecastItem } from "@/lib/cardProfit";
import { diffForecast, isComparable } from "@/lib/forecast";

export const HEADERS = [
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
  // --- 売却実績と予想の答え合わせ ---
  "ステータス",
  "売却日",
  "実売却額(USD)",
  "予想販売価格(USD)",
  "予想とのズレ(%)",
  "利益の差(円)",
];

/** 予想とのズレ2列。比較できない行は空欄（0を入れると「ズレ無し」に見えるため）。 */
function forecastCells(
  card: Parameters<typeof buildForecastItem>[0],
  settings: Parameters<typeof buildForecastItem>[1],
): (string | number)[] {
  const item = buildForecastItem(card, settings);
  if (card.status !== "SOLD" || !isComparable(item)) return ["", ""];
  const d = diffForecast(item);
  return [d.priceDiffPct === null ? "" : Math.round(d.priceDiffPct * 10) / 10, d.profitDiffJpy];
}

/** 鑑定プランの日本語ラベル。 */
const PLAN_JP: Record<string, string> = { REGULAR: "レギュラー", EXPRESS: "エクスプレス" };

/** 1行分のセルを作る。並びは HEADERS と対応させること。 */
export function buildExportRow(
  { card, profit, fxRate, grading }: CardRow,
  settings: Settings,
): (string | number | null | undefined)[] {
  return [
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
      // 売却実績。予想と突き合わせできない（予想未記録・未売却）なら空欄にする
      statusLabel(card.status),
      ymd(card.soldAt),
      card.soldPriceUsd || "",
      card.predictedSellUsd || "",
      ...forecastCells(card, settings)
  ];
}
