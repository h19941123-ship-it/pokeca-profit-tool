// レポート: 実現損益・月次・仕入先別ランキング。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildReports } from "@/lib/reports";
import { BIAS_LABELS, MIN_SAMPLES } from "@/lib/forecast";
import { yen, usd, pct, ymd } from "@/lib/format";

export const metadata = { title: "レポート | ポケカ利益判定ツール" };

export default async function ReportsPage() {
  let cards, settings;
  try {
    [cards, settings] = await Promise.all([prisma.card.findMany(), getSettings()]);
  } catch {
    return <Shell><p className="text-sm text-red-600">データ取得に失敗しました。</p></Shell>;
  }
  const r = buildReports(cards, settings);

  return (
    <Shell>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="売却済 件数" value={`${r.soldCount} 件`} />
        <Tile label="実現損益（累計）" value={yen(r.realizedTotalJpy)} accent={r.realizedTotalJpy >= 0} />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">予想の精度（予想 vs 実績）</h2>
        {r.forecast.count === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            比較できる売却実績がまだありません。カードを「出品中」にした時点の販売価格が
            予想として記録され、売却済にして実売却額を入れると突き合わせます。
          </p>
        ) : (
          <>
            <div className="mb-3 rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
              {r.forecast.reliable ? (
                <p>
                  <b>{BIAS_LABELS[r.forecast.bias!]}</b>：実売価格は予想に対して中央値で{" "}
                  <b className="tabular-nums">{pct(r.forecast.medianPriceDiffPct)}</b> でした（{r.forecast.count}件）。
                  {r.forecast.bias === "OPTIMISTIC" && " 判定しきい値を上げるか、販売価格を控えめに見積もると精度が上がります。"}
                  {r.forecast.bias === "PESSIMISTIC" && " 見送っていたカードの中に、実は仕入れられるものがあるかもしれません。"}
                </p>
              ) : (
                <p className="text-black/60 dark:text-white/60">
                  比較できたのは <b>{r.forecast.count}件</b> です。
                  <b>{MIN_SAMPLES}件</b>を超えるまでは偶然と区別がつかないため、傾向としては扱いません。
                  参考値：中央値 <span className="tabular-nums">{pct(r.forecast.medianPriceDiffPct)}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                予想より高く売れた {r.forecast.overCount}件 ／ 安かった {r.forecast.underCount}件 ／
                ほぼ予想どおり {r.forecast.onCount}件 ・ 利益の差の合計{" "}
                <span className="tabular-nums">{yen(r.forecast.totalProfitDiffJpy)}</span>
              </p>
            </div>
            <Table headers={["カード", "売却日", "予想", "実績", "差", "利益の差"]}>
              {r.forecastRows.map((row) => (
                <tr key={row.id} className="border-b border-black/5 dark:border-white/10">
                  <Td>
                    <Link href={`/cards/${row.id}`} className="text-blue-600 hover:underline">{row.name}</Link>
                  </Td>
                  <Td right>{row.soldAt ? ymd(row.soldAt) : "—"}</Td>
                  <Td right>{usd(row.predictedSellUsd)}</Td>
                  <Td right>{usd(row.soldPriceUsd)}</Td>
                  <Td right accent={row.diff.priceDiffUsd >= 0}>{pct(row.diff.priceDiffPct)}</Td>
                  <Td right accent={row.diff.profitDiffJpy >= 0}>{yen(row.diff.profitDiffJpy)}</Td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">月次 実現損益</h2>
        {r.estimatedCount > 0 && (
          <p className="mb-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            ⚠️ {r.estimatedCount}件は売却時点の手数料・為替が残っていないため、現在の設定で概算しています。
            設定を変えるとこの分の金額は動きます（以後に売却したカードは当時の条件で固定されます）。
          </p>
        )}
        {r.monthly.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">売却済のカードがありません（カードの「ステータス」を売却済にし、売却日・実売却額を入力）。</p>
        ) : (
          <Table headers={["月", "件数", "実現損益"]}>
            {r.monthly.map((m) => (
              <tr key={m.month} className="border-b border-black/5 dark:border-white/10">
                <Td>{m.month}</Td><Td right>{m.count}</Td>
                <Td right accent={m.profitJpy >= 0}>{yen(m.profitJpy)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">仕入先別ランキング（予想利益率）</h2>
        <Table headers={["仕入先", "件数", "平均利益率", "予想利益合計"]}>
          {r.suppliers.map((s) => (
            <tr key={s.supplier} className="border-b border-black/5 dark:border-white/10">
              <Td>{s.supplier}</Td><Td right>{s.count}</Td>
              <Td right>{pct(s.avgRatePct)}</Td>
              <Td right accent={s.totalExpectedProfitJpy >= 0}>{yen(s.totalExpectedProfitJpy)}</Td>
            </tr>
          ))}
        </Table>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">レポート</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← ダッシュボード</Link>
      </div>
      {children}
    </main>
  );
}
function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
      <div className={`text-lg font-bold ${accent === undefined ? "" : accent ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{value}</div>
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, right, accent }: { children?: React.ReactNode; right?: boolean; accent?: boolean }) {
  return (
    <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : "text-left"} ${accent === undefined ? "" : accent ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{children}</td>
  );
}
