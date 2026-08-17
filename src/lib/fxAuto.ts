// 為替の定期自動更新。
// 設定 autoFxUpdate が有効で、前回更新から一定時間経過していれば
// Frankfurter からレートを取得して settings.defaultFxRate を更新する。
// ネットワーク失敗時も例外を投げず、既存の手動値を維持する（クラッシュ耐性）。

import { prisma } from "@/lib/prisma";
import { fetchUsdJpyRate } from "@/lib/fx";
import { logger } from "@/lib/logger";
import type { Settings } from "@/generated/prisma/client";

/** 自動更新の最小間隔（ミリ秒）。既定12時間。 */
const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** 前回更新からの経過時間で「更新すべきか」を判定する純粋関数。 */
export function isFxStale(
  lastUpdatedAt: Date | null,
  now: Date,
  minIntervalMs: number = MIN_INTERVAL_MS,
): boolean {
  if (!lastUpdatedAt) return true;
  return now.getTime() - lastUpdatedAt.getTime() >= minIntervalMs;
}

/**
 * 必要なら為替を自動更新し、最新の Settings を返す。
 * - autoFxUpdate=false → 何もせず引数をそのまま返す
 * - 未更新/期限切れ → 取得を試み、成功時のみ DB 更新
 * @returns 更新後（または元の）Settings
 */
export async function maybeAutoUpdateFx(
  settings: Settings,
  now: Date = new Date(),
): Promise<Settings> {
  if (!settings.autoFxUpdate) return settings;
  if (!isFxStale(settings.lastFxUpdatedAt, now)) return settings;

  const result = await fetchUsdJpyRate();
  if (!result.ok) {
    logger.warn("為替自動更新に失敗（手動値を維持）", { error: result.error });
    return settings;
  }

  try {
    const updated = await prisma.settings.update({
      where: { id: settings.id },
      data: { defaultFxRate: result.rate, lastFxUpdatedAt: now },
    });
    logger.info("為替を自動更新しました", { rate: result.rate, source: result.source });
    return updated;
  } catch (err) {
    logger.error("為替自動更新のDB保存に失敗", err);
    return settings;
  }
}
