// 相場ウォッチの定点観測。eBay の出品を検索して1件記録する。
//
// 叩きすぎないこと:
//   eBay の API には利用上限がある。画面を開くたびに全銘柄を問い合わせると
//   すぐ上限に当たるうえ、1日に何度取っても相場の判断は変わらない。
//   最後の記録から一定時間空いているものだけを取り直す。

import { prisma } from "@/lib/prisma";
import { searchActiveListings } from "@/lib/ebay";
import { logger } from "@/lib/logger";
import type { Watch } from "@/generated/prisma/client";

/** 同じ銘柄を取り直すまでの最短間隔（既定6時間）。 */
export const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** 1回の画面表示で取りに行く上限。ページが重くなりすぎないようにする。 */
export const MAX_PER_RUN = 8;

/** 取り直す時期か（純粋関数）。記録が無ければ常に対象。 */
export function isDue(
  lastObservedAt: Date | null,
  now: Date,
  minIntervalMs: number = MIN_INTERVAL_MS,
): boolean {
  if (!lastObservedAt) return true;
  return now.getTime() - lastObservedAt.getTime() >= minIntervalMs;
}

export type CollectOutcome =
  | { ok: true; watchId: number; medianUsd: number; listingCount: number }
  | { ok: false; watchId: number; reason: string };

/**
 * 1銘柄ぶん観測して保存する。
 * 出品が1件も無いときは記録しない。0件を中央値0として残すと、
 * 次の観測で「0ドルから急騰した」ことになってしまう。
 */
export async function collectOne(watch: Watch): Promise<CollectOutcome> {
  const res = await searchActiveListings(watch.query, {
    limit: 50,
    marketplace: watch.marketplaceId,
  });

  if (!res.ok) {
    return { ok: false, watchId: watch.id, reason: res.reason === "no_credentials" ? "eBayの認証情報が未設定です" : res.error };
  }
  if (!res.summary || res.summary.count === 0) {
    return { ok: false, watchId: watch.id, reason: "出品が見つかりませんでした" };
  }

  const { median, min, max, count } = res.summary;
  await prisma.watchSample.create({
    data: {
      watchId: watch.id,
      medianUsd: median,
      minUsd: min,
      maxUsd: max,
      listingCount: count,
    },
  });
  return { ok: true, watchId: watch.id, medianUsd: median, listingCount: count };
}

/**
 * 取り直す時期が来ている銘柄を観測する。
 * 1件の失敗で全体を止めない（eBay側の一時的な不調で画面が壊れないように）。
 */
export async function collectDue(opts: {
  now?: Date;
  force?: boolean;
  max?: number;
} = {}): Promise<CollectOutcome[]> {
  const now = opts.now ?? new Date();
  const max = opts.max ?? MAX_PER_RUN;

  const watches = await prisma.watch.findMany({
    where: { active: true },
    include: { samples: { orderBy: { observedAt: "desc" }, take: 1 } },
  });

  const due = watches
    .filter((w) => opts.force || isDue(w.samples[0]?.observedAt ?? null, now))
    // 放置が長いものから順に取る
    .sort((a, b) => (a.samples[0]?.observedAt?.getTime() ?? 0) - (b.samples[0]?.observedAt?.getTime() ?? 0))
    .slice(0, max);

  const results: CollectOutcome[] = [];
  for (const w of due) {
    try {
      results.push(await collectOne(w));
    } catch (err) {
      logger.warn("相場ウォッチの観測に失敗", { watchId: w.id, err });
      results.push({ ok: false, watchId: w.id, reason: "観測に失敗しました" });
    }
  }
  return results;
}
