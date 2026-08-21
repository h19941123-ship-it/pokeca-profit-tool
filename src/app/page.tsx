// ダッシュボード（トップページ）。
// 登録カードに利益計算を適用して一覧表示し、利益率・利益額・おすすめ度で並べ替える。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { maybeAutoUpdateFx } from "@/lib/fxAuto";
import {
  buildRows,
  sortRows,
  toSortKey,
  toSortDir,
  mergeQuery,
  summarizeRows,
  type SortKey,
  type SortDir,
  type DashboardSummary,
  type CardRow,
} from "@/lib/dashboard";
import { splitTags } from "@/lib/tags";
import {
  parseFilters,
  buildWhere,
  applyComputedFilters,
  hasAnyFilter,
} from "@/lib/search";
import { SearchBar } from "@/app/SearchBar";
import { DeleteButton } from "@/app/DeleteButton";
import { AlertsPanel } from "@/app/AlertsPanel";
import { CardThumb } from "@/components/CardThumb";
import { buildAlerts, type AlertItem } from "@/lib/alerts";
import { yen, usd, pct } from "@/lib/format";
import type { Decision } from "@/lib/profit";

export default async function Dashboard(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const sortKey = toSortKey(first(sp.sort));
  const sortDir = toSortDir(first(sp.dir));
  const filters = parseFilters(sp);

  // データ取得（失敗してもクラッシュさせない）
  let rows;
  let totalCount = 0;
  let alerts: AlertItem[] = [];
  let summary: DashboardSummary | null = null;
  try {
    const [cards, settingsRaw, allCards, allHistory] = await Promise.all([
      prisma.card.findMany({ where: buildWhere(filters) }),
      getSettings(),
      prisma.card.findMany(),
      prisma.priceHistory.findMany({ orderBy: { recordedAt: "desc" } }),
    ]);
    // 為替の定期自動更新（設定が有効かつ前回から時間経過時のみ）
    const settings = await maybeAutoUpdateFx(settingsRaw);
    totalCount = allCards.length;
    const computed = applyComputedFilters(buildRows(cards, settings), filters);
    rows = sortRows(computed, sortKey, sortDir);

    // 全カードの行（サマリー・アラート用）
    const allRows = buildRows(allCards, settings);
    summary = summarizeRows(allRows);

    // アラート判定（絞り込みに関わらず全カードを対象）
    const histByCard = new Map<number, typeof allHistory>();
    for (const h of allHistory) {
      const list = histByCard.get(h.cardId);
      if (list) list.push(h);
      else histByCard.set(h.cardId, [h]);
    }
    const alertInputs = allRows.map((r) => ({
      card: r.card,
      profit: r.profit,
      history: histByCard.get(r.card.id) ?? [],
    }));
    alerts = buildAlerts(alertInputs, settings);
  } catch {
    return (
      <Shell>
        <p className="rounded-md border border-red-600/40 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          データの取得に失敗しました。開発サーバーとデータベースの状態を確認してください。
        </p>
      </Shell>
    );
  }

  // カードが1件もない（＝検索以前に未登録）
  if (totalCount === 0) {
    return (
      <Shell>
        <div className="rounded-md border border-black/10 p-8 text-center dark:border-white/15">
          <p className="text-sm text-black/60 dark:text-white/60">
            まだカードが登録されていません。
          </p>
          <Link
            href="/cards/new"
            className="mt-4 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            ＋ 最初のカードを登録
          </Link>
        </div>
      </Shell>
    );
  }

  const exportHref = `/api/export${mergeQuery(sp, {})}`;

  return (
    <Shell count={rows.length} total={totalCount} exportHref={exportHref}>
      {summary && <SummaryPanel s={summary} />}
      <AlertsPanel alerts={alerts} />
      <SearchBar filters={filters} sort={sortKey} dir={sortDir} />

      {rows.length === 0 ? (
        <div className="rounded-md border border-black/10 p-8 text-center text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          条件に一致するカードがありません。
          {hasAnyFilter(filters) && (
            <>
              {" "}
              <Link href="/" className="text-blue-600 hover:underline">
                条件をクリア
              </Link>
            </>
          )}
        </div>
      ) : (
      <>
      {/* スマホ向けカード表示（横スクロールしないと利益・判定が見えない問題を回避） */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <MobileCard key={row.card.id} row={row} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-md border border-black/10 md:block dark:border-white/15">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
              <Th>カード名</Th>
              <Th>セット</Th>
              <Th right>仕入(¥)</Th>
              <Th right>販売(USD)</Th>
              <Th right>予想売上(¥)</Th>
              <SortableTh label="予想利益(¥)" k="profitJpy" cur={sortKey} dir={sortDir} sp={sp} right />
              <SortableTh label="利益率" k="profitRate" cur={sortKey} dir={sortDir} sp={sp} right />
              <Th right>販売手数料(¥)</Th>
              <Th right>送料(¥)</Th>
              <Th right>為替</Th>
              <Th>判定</Th>
              <SortableTh label="おすすめ度" k="score" cur={sortKey} dir={sortDir} sp={sp} right />
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ card, profit, fxRate, sellingFeeJpy, grading }) => (
              <tr
                key={card.id}
                className="border-b border-black/5 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Link href={`/cards/${card.id}`} className="shrink-0">
                      <CardThumb url={card.imageUrl} alt={card.name} size={40} />
                    </Link>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/cards/${card.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                          {card.name}
                        </Link>
                        {grading.worthGrading && (
                          <span
                            title={`鑑定の期待利益 ${yen(grading.expectedProfitJpy)}（素体 ${yen(grading.rawProfitJpy)} より +${yen(grading.deltaJpy)}）`}
                            className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            🏅鑑定推奨
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/50 dark:text-white/50">
                        {[card.cardNumber, card.rarity, card.language]
                          .filter(Boolean)
                          .join(" ・ ")}
                      </div>
                      <TagList tags={card.tags} />
                    </div>
                  </div>
                </Td>
                <Td>{card.setName ?? "—"}</Td>
                <Td right>{yen(card.purchasePriceJpy)}</Td>
                <Td right>{usd(card.sellPriceUsd)}</Td>
                <Td right>{yen(profit.revenueJpy)}</Td>
                <Td right>
                  <span className={profit.profitJpy >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}>
                    {yen(profit.profitJpy)}
                  </span>
                </Td>
                <Td right>{pct(profit.profitRate)}</Td>
                <Td right>{yen(sellingFeeJpy)}</Td>
                <Td right>{yen(profit.fees.shippingJpy)}</Td>
                <Td right>{fxRate}</Td>
                <Td>
                  <DecisionBadge decision={profit.decision} label={profit.decisionLabel} />
                </Td>
                <Td right>
                  <ScoreCell score={profit.score} />
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <Link href={`/cards/${card.id}/edit`} className="text-xs text-blue-600 hover:underline">
                      編集
                    </Link>
                    <DeleteButton id={card.id} name={card.name} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
      <p className="mt-3 text-xs text-black/40 dark:text-white/40">
        ※ 価格は変動します。表示は入力値と設定に基づく「予想」です。
      </p>
    </Shell>
  );
}

/** ページ枠（見出し＋登録ボタン）。 */
function Shell({
  children,
  count,
  total,
  exportHref,
}: {
  children: React.ReactNode;
  count?: number;
  total?: number;
  exportHref?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ダッシュボード</h1>
          {count !== undefined && (
            <p className="text-xs text-black/50 dark:text-white/50">
              {total !== undefined && total !== count
                ? `表示 ${count} 件 / 全 ${total} 件`
                : `登録 ${count} 件`}
            </p>
          )}
        </div>
        {/* 折り返しを許可し、各項目は改行させない（狭い画面で「設/定」のように割れるのを防ぐ） */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {exportHref && (
            <a href={exportHref} className="whitespace-nowrap rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]">
              CSV出力
            </a>
          )}
          <Link href="/watch" className="whitespace-nowrap text-sm text-blue-600 hover:underline">
            相場ウォッチ
          </Link>
          <Link href="/reports" className="whitespace-nowrap text-sm text-blue-600 hover:underline">
            レポート
          </Link>
          <Link href="/cards/import" className="whitespace-nowrap text-sm text-blue-600 hover:underline">
            一括登録
          </Link>
          <Link href="/cards/buyback" className="whitespace-nowrap text-sm text-blue-600 hover:underline">
            買取額
          </Link>
          <Link href="/settings" className="whitespace-nowrap text-sm text-blue-600 hover:underline">
            設定
          </Link>
          <Link
            href="/cards/new"
            className="whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ＋ カードを登録
          </Link>
        </div>
      </div>
      {children}
    </main>
  );
}

/** 通常のヘッダーセル。 */
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

/** 並べ替え可能なヘッダーセル（クリックで昇順/降順トグル・検索条件は保持）。 */
function SortableTh({
  label,
  k,
  cur,
  dir,
  sp,
  right,
}: {
  label: string;
  k: SortKey;
  cur: SortKey;
  dir: SortDir;
  sp: Record<string, string | string[] | undefined>;
  right?: boolean;
}) {
  const active = cur === k;
  // 同じ列を押したら方向トグル。別の列なら降順から開始。
  const nextDir: SortDir = active && dir === "desc" ? "asc" : "desc";
  const arrow = active ? (dir === "desc" ? "▼" : "▲") : "";
  return (
    <th className={`whitespace-nowrap px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}>
      <Link
        href={`/${mergeQuery(sp, { sort: k, dir: nextDir })}`}
        className={`inline-flex items-center gap-1 hover:underline ${active ? "text-blue-600" : ""}`}
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </Link>
    </th>
  );
}

/** 通常のデータセル。 */
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 align-top ${right ? "text-right tabular-nums" : "text-left"}`}>
      {children}
    </td>
  );
}

/**
 * スマホ向けの1件カード。
 * 幅の狭い画面では 13 列のテーブルを横スクロールしないと
 * 「予想利益・利益率・判定」が見えないため、重要な項目を先頭に置いて縦に積む。
 */
function MobileCard({ row }: { row: CardRow }) {
  const { card, profit, fxRate, grading } = row;
  return (
    <li className="rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-start gap-3">
        <Link href={`/cards/${card.id}`} className="shrink-0">
          <CardThumb url={card.imageUrl} alt={card.name} size={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/cards/${card.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
              {card.name}
            </Link>
            {grading.worthGrading && (
              <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                🏅鑑定推奨
              </span>
            )}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">
            {[card.setName, card.cardNumber, card.rarity, card.language].filter(Boolean).join(" ・ ")}
          </div>
          <TagList tags={card.tags} />
        </div>
        <DecisionBadge decision={profit.decision} label={profit.decisionLabel} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <MobileStat label="予想利益">
          <span className={profit.profitJpy >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}>
            {yen(profit.profitJpy)}
          </span>
        </MobileStat>
        <MobileStat label="利益率">{pct(profit.profitRate)}</MobileStat>
        <MobileStat label="おすすめ度">{profit.score}</MobileStat>
        <MobileStat label="仕入">{yen(card.purchasePriceJpy)}</MobileStat>
        <MobileStat label="販売">{usd(card.sellPriceUsd)}</MobileStat>
        <MobileStat label="為替">{fxRate}</MobileStat>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-black/5 pt-2 dark:border-white/10">
        <Link href={`/cards/${card.id}`} className="text-xs text-blue-600 hover:underline">
          詳細
        </Link>
        <Link href={`/cards/${card.id}/edit`} className="text-xs text-blue-600 hover:underline">
          編集
        </Link>
        <DeleteButton id={card.id} name={card.name} />
      </div>
    </li>
  );
}

function MobileStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-black/50 dark:text-white/50">{label}</div>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/** タグ（カンマ区切り文字列）をチップ表示。クリックでそのタグ名で絞り込む。 */
function TagList({ tags }: { tags: string | null }) {
  const list = splitTags(tags);
  if (list.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {list.map((t) => (
        <Link
          key={t}
          href={`/?q=${encodeURIComponent(t)}`}
          className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
        >
          #{t}
        </Link>
      ))}
    </div>
  );
}

/** 仕入れ判定バッジ。 */
function DecisionBadge({ decision, label }: { decision: Decision; label: string }) {
  const styles: Record<Decision, string> = {
    BUY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    CONSIDER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    SKIP: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    UNSET: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[decision]}`}>
      {label}
    </span>
  );
}

/** おすすめ度セル（数値＋ミニバー）。 */
function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-gray-400";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{score}</span>
    </div>
  );
}

/** サマリーパネル（在庫込みの合計。売却済は除く）。 */
function SummaryPanel({ s }: { s: DashboardSummary }) {
  return (
    <>
    <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryTile label="総仕入額（在庫込）" value={yen(s.totalCostJpy)} />
      <SummaryTile
        label="予想総利益（在庫込）"
        value={yen(s.totalExpectedProfitJpy)}
        accent={s.totalExpectedProfitJpy >= 0}
      />
      <SummaryTile label="平均利益率" value={pct(s.avgProfitRate)} />
      <SummaryTile
        label="判定"
        value={
          s.unset > 0
            ? `候補${s.buy} / 検討${s.consider} / 見送り${s.skip} / 未設定${s.unset}`
            : `候補${s.buy} / 検討${s.consider} / 見送り${s.skip}`
        }
      />
    </section>
    {s.soldCount > 0 && (
      <p className="-mt-3 mb-5 text-xs text-black/50 dark:text-white/50">
        売却済 {s.soldCount}件 は上の集計に含めていません（手元に無いため）。実現した損益は{" "}
        <Link href="/reports" className="text-blue-600 hover:underline">レポート</Link> で見られます。
      </p>
    )}
    </>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
      <div className={`text-lg font-bold ${accent === undefined ? "" : accent ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
        {value}
      </div>
    </div>
  );
}

/** searchParams の値（string | string[] | undefined）から最初の文字列を取り出す。 */
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
