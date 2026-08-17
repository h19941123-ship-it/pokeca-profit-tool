// 表示用の整形ヘルパー（画面・CSVで共通利用）。

/** 円表示（例: ¥3,440 / -¥2,000）。マイナスは記号を先頭に置く。 */
export function yen(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}¥${Math.abs(v).toLocaleString("ja-JP")}`;
}

/** USD表示（例: $80）。 */
export function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * パーセント表示。null は「—」。
 * 桁数を小数1桁に固定して、一覧で数字が縦にそろうようにする
 * （固定しないと 67.6% / 59% / -66.67% が混在して読みにくい）。
 */
export function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

/** 日付を YYYY-MM-DD 表示（null は空文字）。 */
export function ymd(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
