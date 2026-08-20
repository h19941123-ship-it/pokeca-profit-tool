// 通知（アラート）判定エンジン（純粋関数）。
// ダッシュボードを開いたときに、各カードの現在値と価格履歴を比較して
// 「注目すべき状態」を検出する。サーバー常駐や外部送信は不要。

import type { Card, Settings, PriceHistory } from "@/generated/prisma/client";
import type { ProfitResult } from "@/lib/profit";
import { pct, usd, yen } from "@/lib/format";

/** アラートの種類。 */
export type AlertType = "high_rate" | "sell_up" | "buy_down";

/** 1件のアラート。 */
export interface AlertItem {
  cardId: number;
  cardName: string;
  type: AlertType;
  message: string;
}

/** アラート判定の入力（カードごと）。history は新しい順（最新が先頭）。 */
export interface AlertInput {
  card: Card;
  profit: ProfitResult;
  history: PriceHistory[];
}

/** 変化率(%)を計算（基準が0以下なら null）。 */
function changePct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * アラートを組み立てる。
 *  - high_rate : 現在の利益率が notifyProfitRatePct 以上
 *  - sell_up   : 販売価格が前回より notifyPriceChangePct% 以上 上昇
 *  - buy_down  : 仕入価格が前回より notifyPriceChangePct% 以上 下落
 */
export function buildAlerts(inputs: AlertInput[], settings: Settings): AlertItem[] {
  const alerts: AlertItem[] = [];
  const rateThreshold = settings.notifyProfitRatePct;
  const changeThreshold = settings.notifyPriceChangePct;

  for (const { card, profit, history } of inputs) {
    // 売却済は手元に無い。「利益率が高い」「値上がりした」と言われても
    // もう打つ手が無いので通知しない。
    if (card.status === "SOLD") continue;

    // 高利益率
    if (profit.profitRate !== null && profit.profitRate >= rateThreshold) {
      alerts.push({
        cardId: card.id,
        cardName: card.name,
        type: "high_rate",
        message: `利益率 ${pct(profit.profitRate)}（${profit.decisionLabel}）— 予想利益 ${yen(profit.profitJpy)}`,
      });
    }

    // 価格変動（最新と1つ前を比較）
    if (history.length >= 2) {
      const latest = history[0];
      const prev = history[1];

      const sellChange = changePct(prev.sellPriceUsd, latest.sellPriceUsd);
      if (sellChange !== null && sellChange >= changeThreshold) {
        alerts.push({
          cardId: card.id,
          cardName: card.name,
          type: "sell_up",
          message: `販売価格が上昇 ${usd(prev.sellPriceUsd)} → ${usd(latest.sellPriceUsd)}（+${pct(sellChange)}）`,
        });
      }

      const buyChange = changePct(prev.purchasePriceJpy, latest.purchasePriceJpy);
      if (buyChange !== null && buyChange <= -changeThreshold) {
        alerts.push({
          cardId: card.id,
          cardName: card.name,
          type: "buy_down",
          message: `仕入価格が下落 ${yen(prev.purchasePriceJpy)} → ${yen(latest.purchasePriceJpy)}（${pct(buyChange)}）`,
        });
      }
    }
  }

  return alerts;
}

/** アラート種別ごとの表示ラベルとアイコン。 */
export const ALERT_META: Record<AlertType, { label: string; icon: string }> = {
  high_rate: { label: "高利益率", icon: "🎯" },
  sell_up: { label: "販売価格 上昇", icon: "📈" },
  buy_down: { label: "仕入価格 下落", icon: "📉" },
};
