// 価格履歴の記録。カードの新規登録・更新のたびにスナップショットを1件保存する。
// これを時系列に並べて推移グラフを描く。記録失敗は握りつぶして保存本体を止めない。

import type { Card, Settings } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeCardProfit, resolveFxRate } from "@/lib/cardProfit";
import { logger } from "@/lib/logger";

/** 現在のカード状態から価格履歴を1件記録する。 */
export async function recordPriceHistory(
  card: Card,
  settings: Settings,
): Promise<void> {
  try {
    const profit = computeCardProfit(card, settings);
    const fxRate = resolveFxRate(card, settings);
    const profitRate = profit.profitRate ?? 0;

    // 直前の記録と同一なら追加しない（変更なしの保存でグラフが冗長になるのを防ぐ）
    const last = await prisma.priceHistory.findFirst({
      where: { cardId: card.id },
      orderBy: { recordedAt: "desc" },
    });
    if (
      last &&
      last.purchasePriceJpy === card.purchasePriceJpy &&
      last.sellPriceUsd === card.sellPriceUsd &&
      last.fxRate === fxRate &&
      last.profitJpy === profit.profitJpy
    ) {
      return; // 変化なし
    }

    await prisma.priceHistory.create({
      data: {
        cardId: card.id,
        purchasePriceJpy: card.purchasePriceJpy,
        sellPriceUsd: card.sellPriceUsd,
        fxRate,
        profitJpy: profit.profitJpy,
        profitRate,
      },
    });
  } catch (err) {
    logger.warn("価格履歴の記録に失敗", err);
  }
}
