// カード詳細ページ。現在の利益サマリ＋価格推移グラフ（利益・販売価格）＋履歴テーブル。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeCardProfit, resolveFxRate, computeCardAdvice, computeCardChannel, resolveShipping, buildForecastItem } from "@/lib/cardProfit";
import { diffForecast, isComparable } from "@/lib/forecast";
import { computeCardGradingBoth, PLAN_LABELS, type GradingPlan } from "@/lib/cardGrading";
import type { GradingResult } from "@/lib/grading";
import { PriceHistoryChart, type HistoryDatum } from "@/components/PriceHistoryChart";
import { CardThumb } from "@/components/CardThumb";
import { yen, usd, pct, ymd } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { splitTags } from "@/lib/tags";

export const metadata = { title: "カード詳細 | ポケカ利益判定ツール" };

/** 日時を M/D 表示に。 */
function md(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
/** 日時を YYYY-MM-DD HH:mm 表示に。 */
function datetime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function CardDetailPage(props: PageProps<"/cards/[id]">) {
  const { id } = await props.params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) notFound();

  const [card, settings] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId } }),
    getSettings(),
  ]);
  if (!card) notFound();

  const history = await prisma.priceHistory.findMany({
    where: { cardId },
    orderBy: { recordedAt: "asc" },
  });

  const profit = computeCardProfit(card, settings);
  const bundle = resolveShipping(card, settings);
  // 予想と実績の突き合わせ（予想を固定できていた売却済カードだけ）
  const forecastItem = buildForecastItem(card, settings);
  const forecast =
    card.status === "SOLD" && isComparable(forecastItem)
      ? { item: forecastItem, diff: diffForecast(forecastItem) }
      : null;
  const fxRate = resolveFxRate(card, settings);
  const gradingBoth = computeCardGradingBoth(card, settings);
  const grading = gradingBoth.selected === "EXPRESS" ? gradingBoth.express : gradingBoth.regular;
  const advice = computeCardAdvice(card, settings);
  const tags = splitTags(card.tags);
  const channel = computeCardChannel(card, settings);

  const chartData: HistoryDatum[] = history.map((h) => ({
    label: md(h.recordedAt),
    profitJpy: h.profitJpy,
    profitRate: h.profitRate,
    sellPriceUsd: h.sellPriceUsd,
    fxRate: h.fxRate,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <CardThumb url={card.imageUrl} alt={card.name} size={72} rounded="rounded-lg" />
          <div>
            <h1 className="text-xl font-bold">{card.name}</h1>
            <p className="text-xs text-black/50 dark:text-white/50">
              {[card.setName, card.cardNumber, card.rarity, card.language].filter(Boolean).join(" ・ ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/cards/${card.id}/edit`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            編集
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← ダッシュボード
          </Link>
        </div>
      </div>

      {/* 現在のサマリ */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="仕入" value={yen(card.purchasePriceJpy)} />
        <Stat label="販売(USD)" value={usd(card.sellPriceUsd)} />
        <Stat label="予想利益" value={yen(profit.profitJpy)} accent={profit.profitJpy >= 0} />
        <Stat label="利益率" value={pct(profit.profitRate)} />
        <Stat label="予想売上" value={yen(profit.revenueJpy)} />
        <Stat label="販売手数料" value={yen(profit.fees.ebayJpy + profit.fees.paymentJpy + profit.fees.fxJpy)} />
        <Stat
          label={bundle.cards > 1 ? `送料（${bundle.cards}枚まとめ）` : "送料"}
          value={yen(profit.fees.shippingJpy)}
          note={bundle.cards > 1 ? `1枚で送ると ${yen(bundle.soloJpy)}` : undefined}
        />
        <Stat label="関税(DDP)" value={yen(profit.fees.tariffJpy)} />
        <Stat label="為替" value={`${fxRate} 円/USD`} />
        <Stat label="判定 / スコア" value={`${profit.decisionLabel} / ${profit.score}`} />
      </div>

      {/* 仕入れの実務情報（入力できるのに詳細で見られなかった項目） */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">仕入れ情報</h2>
        <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Meta label="ステータス" value={statusLabel(card.status)} />
            <Meta label="在庫数" value={`${card.stock}`} />
            <Meta label="仕入れ先" value={card.supplier} />
            <Meta label="購入日" value={ymd(card.purchasedAt)} />
            <Meta label="コンディション" value={card.condition} />
            <Meta label="国内買取額" value={card.domesticBuybackJpy > 0 ? yen(card.domesticBuybackJpy) : null} />
            {card.status === "SOLD" && (
              <>
                <Meta label="実売却額" value={card.soldPriceUsd ? usd(card.soldPriceUsd) : null} />
                <Meta label="売却日" value={ymd(card.soldAt)} />
              </>
            )}
          </dl>

          {forecast && (
            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <div className="text-xs text-black/50 dark:text-white/50">予想と実績</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span>
                  売る前の見込み <b className="tabular-nums">{usd(forecast.item.predictedSellUsd)}</b>
                </span>
                <span>→</span>
                <span>
                  実際 <b className="tabular-nums">{usd(forecast.item.soldPriceUsd)}</b>
                </span>
                <span
                  className={
                    forecast.diff.priceDiffUsd >= 0
                      ? "font-semibold text-green-700 dark:text-green-400"
                      : "font-semibold text-red-600"
                  }
                >
                  {pct(forecast.diff.priceDiffPct)}
                </span>
                <span className="text-black/60 dark:text-white/60">
                  利益の差{" "}
                  <b className={`tabular-nums ${forecast.diff.profitDiffJpy >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
                    {yen(forecast.diff.profitDiffJpy)}
                  </b>
                </span>
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <div className="text-xs text-black/50 dark:text-white/50">タグ</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/?q=${encodeURIComponent(t)}`}
                    className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {card.notes && (
            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <div className="text-xs text-black/50 dark:text-white/50">メモ</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{card.notes}</p>
            </div>
          )}
        </div>
      </section>

      {/* 仕入れ判断の補助 */}
      <div className="mb-8 rounded-md border border-blue-500/30 bg-blue-50/50 p-4 dark:bg-blue-950/20">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-black/50 dark:text-white/50">
              上限仕入れ額（利益率{advice.targetRatePct}%を出すには）
            </div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {advice.maxPurchaseJpy === null ? "利益が出ません" : `${yen(advice.maxPurchaseJpy)} まで`}
            </div>
          </div>
          <div>
            <div className="text-xs text-black/50 dark:text-white/50">損益分岐の販売価格（赤字にならない下限）</div>
            <div className="text-lg font-bold">
              {advice.breakEvenSellUsd === null ? "—" : `${usd(advice.breakEvenSellUsd)} 以上`}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-black/40 dark:text-white/40">
          現在の販売価格・手数料・送料・関税の設定に基づく試算です。
        </p>
      </div>

      {/* 国内買取との比較 */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">国内で売る / 海外に出す</h2>
        {!channel.configured ? (
          <p className="rounded-md border border-black/10 p-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            国内買取額が未入力です。「編集」で買取チェッカー等で調べた金額を入れると、
            国内の店に売った場合と海外に出した場合のどちらが得か比較できます。
          </p>
        ) : (
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div
              className={`mb-3 rounded-md p-3 text-sm ${
                channel.channel === "EXPORT"
                  ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                  : channel.channel === "DOMESTIC"
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    : "bg-black/[0.03] text-black/70 dark:bg-white/[0.05] dark:text-white/70"
              }`}
            >
              <b>{channel.channelLabel}</b>
              {channel.channel === "EXPORT" && (
                <>：海外の方が {yen(channel.gainJpy)} 多く手元に残ります</>
              )}
              {channel.channel === "DOMESTIC" && (
                <>：国内買取の方が {yen(-channel.gainJpy)} 多く、手間もかかりません</>
              )}
              {channel.channel === "EITHER" && (
                <>：差は {yen(channel.gainJpy)} だけ。発送の手間を考えると国内でも十分です</>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="国内買取（手取り）" value={yen(channel.domesticNetJpy)} />
              <Stat label="海外販売（手取り）" value={yen(channel.exportNetJpy)} />
              <Stat
                label="差額（海外 − 国内）"
                value={`${channel.gainJpy >= 0 ? "+" : ""}${yen(channel.gainJpy)}`}
                accent={channel.gainJpy >= 0}
              />
            </div>
            <p className="mt-3 text-xs text-black/40 dark:text-white/40">
              ※ 手取りは仕入れ値を引く前の金額です。すでに持っているカードなら仕入れ値は
              どちらにも共通なので、この比較には影響しません。海外側は手数料・送料・梱包・関税を
              差し引いています。
            </p>
          </div>
        )}
      </section>

      {/* PSA鑑定シミュレーション */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">PSA鑑定シミュレーション</h2>
        {!grading.configured ? (
          <p className="rounded-md border border-black/10 p-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            鑑定シナリオ未設定です。「編集」で PSA10/PSA9 の販売価格と PSA10 確率を入力すると、
            「素体で売る」場合と「鑑定して売る」場合の期待利益を比較できます。
          </p>
        ) : (
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {/* 判定（選択中プラン） */}
            <div className={`mb-3 rounded-md p-3 text-sm ${grading.worthGrading ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300" : "bg-black/[0.03] text-black/70 dark:bg-white/[0.05] dark:text-white/70"}`}>
              <span className="mr-1 rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/15">
                {PLAN_LABELS[gradingBoth.selected]}プラン
              </span>
              {grading.worthGrading ? "🏅 鑑定した方が有利" : "素体で売る方が有利（または差が小さい）"}：
              期待利益 <b>{yen(grading.expectedProfitJpy)}</b> vs 素体利益 <b>{yen(grading.rawProfitJpy)}</b>
              （差 {grading.deltaJpy >= 0 ? "+" : ""}{yen(grading.deltaJpy)}）
            </div>

            {/* プラン比較 */}
            <div className="mb-3 overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
                    <th className="px-3 py-2 font-semibold">プラン</th>
                    <th className="px-3 py-2 text-right font-semibold">鑑定料</th>
                    <th className="px-3 py-2 text-right font-semibold">鑑定コスト計</th>
                    <th className="px-3 py-2 text-right font-semibold">期待利益</th>
                    <th className="px-3 py-2 text-right font-semibold">期待利益率</th>
                    <th className="px-3 py-2 font-semibold">判定</th>
                  </tr>
                </thead>
                <tbody>
                  <PlanRow label="レギュラー" plan="REGULAR" selected={gradingBoth.selected} g={gradingBoth.regular} />
                  <PlanRow label="エクスプレス" plan="EXPRESS" selected={gradingBoth.selected} g={gradingBoth.express} />
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="鑑定コスト合計" value={yen(grading.gradingTotalJpy)} />
              <Stat label="総投資（仕入＋鑑定）" value={yen(grading.totalInvestJpy)} />
              <Stat label="期待利益" value={yen(grading.expectedProfitJpy)} accent={grading.expectedProfitJpy >= 0} />
              <Stat label="期待利益率" value={pct(grading.expectedProfitRate)} />
              <Stat label={`PSA10 (${card.psa10Prob}%)で売る`} value={yen(grading.profit10Jpy)} accent={grading.profit10Jpy >= 0} />
              <Stat label={`PSA9以下 (${Math.round((100 - card.psa10Prob) * 10) / 10}%)で売る`} value={yen(grading.profit9Jpy)} accent={grading.profit9Jpy >= 0} />
              <Stat label="素体で売る利益" value={yen(grading.rawProfitJpy)} accent={grading.rawProfitJpy >= 0} />
              <Stat label="鑑定料(円換算)" value={yen(grading.gradingFeeJpy)} />
            </div>
            <p className="mt-3 text-xs text-black/40 dark:text-white/40">
              ※ 鑑定料・送料・代行手数料は設定で調整できます。グレードは確率、価格は入力値に基づく「予想」です。
            </p>
          </div>
        )}
      </section>

      {/* 推移グラフ（系列切り替え） */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">推移グラフ</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            まだ履歴がありません。カードを編集・保存すると記録されていきます。
          </p>
        ) : (
          <PriceHistoryChart data={chartData} />
        )}
      </section>

      {/* 履歴テーブル（グラフの数値ビュー＝アクセシビリティ） */}
      <section>
        <h2 className="mb-2 text-base font-semibold">履歴</h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            まだ履歴がありません。編集して保存すると記録されます。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
                  <th className="px-3 py-2 font-semibold">日時</th>
                  <th className="px-3 py-2 text-right font-semibold">仕入(¥)</th>
                  <th className="px-3 py-2 text-right font-semibold">販売($)</th>
                  <th className="px-3 py-2 text-right font-semibold">為替</th>
                  <th className="px-3 py-2 text-right font-semibold">予想利益(¥)</th>
                  <th className="px-3 py-2 text-right font-semibold">利益率</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.id} className="border-b border-black/5 dark:border-white/10">
                    <td className="px-3 py-2">{datetime(h.recordedAt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(h.purchasePriceJpy)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(h.sellPriceUsd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.fxRate}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(h.profitJpy)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(h.profitRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-black/40 dark:text-white/40">
        ※ 価格は変動します。表示は入力値と設定に基づく「予想」です。
      </p>
    </main>
  );
}

function PlanRow({
  label,
  plan,
  selected,
  g,
}: {
  label: string;
  plan: GradingPlan;
  selected: GradingPlan;
  g: GradingResult;
}) {
  const isSelected = plan === selected;
  return (
    <tr className={`border-b border-black/5 dark:border-white/10 ${isSelected ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}>
      <td className="px-3 py-2">
        {label}
        {isSelected && <span className="ml-1 text-xs text-blue-600">（選択中）</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{yen(g.gradingFeeJpy)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{yen(g.gradingTotalJpy)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${g.expectedProfitJpy >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
        {yen(g.expectedProfitJpy)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(g.expectedProfitRate)}</td>
      <td className="px-3 py-2">{g.worthGrading ? "🏅推奨" : "—"}</td>
    </tr>
  );
}

/** 仕入れ情報の1項目（未入力は「—」）。 */
function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-black/50 dark:text-white/50">{label}</dt>
      <dd className="text-sm font-medium">{value ? value : "—"}</dd>
    </div>
  );
}

function Stat({ label, value, accent, note }: { label: string; value: string; accent?: boolean; note?: string }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
      <div className={`font-semibold ${accent === undefined ? "" : accent ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
        {value}
      </div>
      {note && <div className="mt-0.5 text-[11px] text-black/45 dark:text-white/45">{note}</div>}
    </div>
  );
}
