// 相場ウォッチ: 登録した銘柄の出品価格を定期観測し、動いたものを知らせる。

import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectDue } from "@/lib/watchCollect";
import { analyzeTrend, SIGNAL_LABELS, type TrendSignal, type TrendResult } from "@/lib/marketTrend";
import { hasEbayCredentials } from "@/lib/ebay";
import { getMarketplace } from "@/lib/marketplaces";
import { buildEbaySearchUrl } from "@/lib/ebayLink";
import { Sparkline } from "@/components/Sparkline";
import { WatchForm } from "./WatchForm";
import { deleteWatchAction, toggleWatchAction, refreshWatchesAction } from "./actions";
import { usd, pct, ymd } from "@/lib/format";
import { logger } from "@/lib/logger";

export const metadata = { title: "相場ウォッチ | ポケカ利益判定ツール" };

/** 「買われている」を先頭に。動きの無いものは下へ。 */
const SIGNAL_ORDER: Record<TrendSignal, number> = {
  HEATING: 0,
  RISING: 1,
  FALLING: 2,
  FLAT: 3,
  INSUFFICIENT: 4,
};

const SIGNAL_STYLES: Record<TrendSignal, string> = {
  HEATING: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  RISING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  FLAT: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  FALLING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  INSUFFICIENT: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
};

export default async function WatchPage() {
  await connection();

  // 期限が来ているものだけ、上限つきで観測し直す。
  // 失敗しても画面は出す（eBay が不調でも過去の記録は見せたい）。
  if (hasEbayCredentials()) {
    try {
      await collectDue();
    } catch (err) {
      logger.warn("相場ウォッチの自動観測に失敗", err);
    }
  }

  const watches = await prisma.watch.findMany({
    include: { samples: { orderBy: { observedAt: "desc" }, take: 60 } },
    orderBy: { createdAt: "desc" },
  });

  const rows = watches
    .map((w) => ({ w, trend: analyzeTrend(w.samples) }))
    .sort((a, b) => {
      const d = SIGNAL_ORDER[a.trend.signal] - SIGNAL_ORDER[b.trend.signal];
      if (d !== 0) return d;
      return (b.trend.priceChangePct ?? -Infinity) - (a.trend.priceChangePct ?? -Infinity);
    });

  const heating = rows.filter((r) => r.trend.signal === "HEATING").length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">相場ウォッチ</h1>
        <div className="flex items-center gap-4">
          <form action={refreshWatchesAction}>
            <button type="submit" className="text-sm text-blue-600 hover:underline">
              いま全部更新
            </button>
          </form>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← ダッシュボード</Link>
        </div>
      </div>

      {!hasEbayCredentials() && (
        <p className="mb-5 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          eBayの認証情報が未設定のため観測できません。<code>EBAY_APP_ID</code> と <code>EBAY_CERT_ID</code> を設定してください。
        </p>
      )}

      <div className="mb-5 rounded-md border border-black/10 p-3 text-xs leading-relaxed text-black/60 dark:border-white/15 dark:text-white/60">
        <p>
          見ているのは<b>eBayの出品中の希望価格</b>です。実際に売れた価格ではありません。
          売り手が一斉に強気になっただけでも中央値は上がります。
        </p>
        <p className="mt-1">
          そのため<b>出品件数</b>も併せて見ます。値段が上がり、かつ出品が減っているものだけを
          <b className="text-red-700 dark:text-red-400">「買われている」</b>として先頭に出します。
          値段だけが上がっているものは<b>「値上がり」</b>止まりです。
        </p>
        <p className="mt-1">
          観測は最短6時間おき。直近3日と、その前の11日ぶんを比べています。
        </p>
      </div>

      {heating > 0 && (
        <p className="mb-5 rounded-md border border-red-300/60 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          <b>{heating}件</b> が「買われている」状態です。
        </p>
      )}

      <div className="mb-6">
        <WatchForm />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          まだ登録がありません。上のフォームから気になるカードを追加してください。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
                <th className="px-3 py-2 font-semibold">カード</th>
                <th className="px-3 py-2 font-semibold">状態</th>
                <th className="px-3 py-2 text-right font-semibold">直近の中央値</th>
                <th className="px-3 py-2 text-right font-semibold">価格の変化</th>
                <th className="px-3 py-2 text-right font-semibold">出品件数</th>
                <th className="px-3 py-2 text-right font-semibold">推移</th>
                <th className="px-3 py-2 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, trend }) => (
                <WatchRow key={w.id} watch={w} trend={trend} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

type WatchWithSamples = Awaited<ReturnType<typeof prisma.watch.findMany>>[number] & {
  samples: { observedAt: Date; medianUsd: number; listingCount: number }[];
};

function WatchRow({ watch, trend }: { watch: WatchWithSamples; trend: TrendResult }) {
  // 推移は古い順に描く（DBからは新しい順で来る）
  const series = [...watch.samples].reverse().map((s) => s.medianUsd);
  const latest = watch.samples[0];
  const market = getMarketplace(watch.marketplaceId);
  const searchUrl = buildEbaySearchUrl(watch.query, { marketplace: watch.marketplaceId });

  return (
    <tr className={`border-b border-black/5 dark:border-white/10 ${watch.active ? "" : "opacity-50"}`}>
      <td className="px-3 py-2">
        {searchUrl ? (
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            {watch.label}
          </a>
        ) : (
          <span className="font-medium">{watch.label}</span>
        )}
        <div className="text-[11px] text-black/45 dark:text-white/45">
          {watch.query}
          {market ? ` ・ ${market.label}` : ""}
          {!watch.active && " ・ 停止中"}
        </div>
        {watch.note && (
          <div className="text-[11px] text-black/45 dark:text-white/45">{watch.note}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIGNAL_STYLES[trend.signal]}`}>
          {SIGNAL_LABELS[trend.signal]}
        </span>
        {trend.signal === "INSUFFICIENT" && (
          <div className="mt-0.5 text-[11px] text-black/45 dark:text-white/45">
            比較には数日ぶんの記録が要ります
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {trend.recentMedianUsd !== null ? usd(trend.recentMedianUsd) : latest ? usd(latest.medianUsd) : "—"}
        {latest && (
          <div className="text-[11px] text-black/45 dark:text-white/45">{ymd(latest.observedAt)}</div>
        )}
      </td>
      <td
        className={`px-3 py-2 text-right tabular-nums ${
          trend.priceChangePct === null
            ? ""
            : trend.priceChangePct >= 0
              ? "text-green-700 dark:text-green-400"
              : "text-red-600"
        }`}
      >
        {pct(trend.priceChangePct)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {trend.recentListingCount !== null ? trend.recentListingCount : latest?.listingCount ?? "—"}
        {trend.countChangePct !== null && (
          <div
            className={`text-[11px] ${trend.countChangePct <= 0 ? "text-red-600" : "text-black/45 dark:text-white/45"}`}
          >
            {pct(trend.countChangePct)}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Sparkline values={series} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <form action={toggleWatchAction}>
            <input type="hidden" name="id" value={watch.id} />
            <button type="submit" className="text-xs text-blue-600 hover:underline">
              {watch.active ? "停止" : "再開"}
            </button>
          </form>
          <form action={deleteWatchAction}>
            <input type="hidden" name="id" value={watch.id} />
            <button type="submit" className="text-xs text-red-600 hover:underline">
              削除
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
