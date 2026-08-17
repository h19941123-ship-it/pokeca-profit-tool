// 依存ライブラリなしの折れ線グラフ（単一系列・時系列）。
// 色・文字サイズは SVG 属性で直接指定し、CSS(Tailwind) が未適用でも崩れないようにする。
// テキストは currentColor（テーマ連動、未適用時は黒にフォールバック）。線/点は固定のエメラルド。

export interface ChartPoint {
  label: string; // x軸ラベル（日付など）
  value: number; // y値
}

const W = 720;
const H = 240;
const PAD = { top: 24, right: 72, bottom: 34, left: 72 };
const ACCENT = "#059669"; // emerald-600（ライト/ダーク両方で視認可）

export function LineChart({
  points,
  formatValue,
  ariaLabel,
}: {
  points: ChartPoint[];
  formatValue: (n: number) => string;
  ariaLabel: string;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        まだ履歴がありません。カードを編集・保存すると記録されていきます。
      </p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // y範囲は 0 を含める（0基準線を見せるため）。上下に10%の余白。
  const values = points.map((p) => p.value);
  let yMin = Math.min(0, ...values);
  let yMax = Math.max(0, ...values);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = (yMax - yMin) * 0.1;
  yMin -= pad;
  yMax += pad;

  const x = (i: number) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");

  const zeroInRange = yMin < 0 && yMax > 0;
  const last = points[points.length - 1];
  const xTickIdx =
    points.length <= 2
      ? points.map((_, i) => i)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full text-black dark:text-white"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* プロット枠（上端・下端の薄い基準線） */}
      <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top} y2={PAD.top} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />

      {/* y軸の上端・下端ラベル */}
      <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>
        {formatValue(yMax)}
      </text>
      <text x={PAD.left - 8} y={PAD.top + plotH + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>
        {formatValue(yMin)}
      </text>

      {/* 0 基準線（ラベルは重なり回避のため線のみ） */}
      {zeroInRange && (
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}

      {/* 折れ線 */}
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* データ点（ホバーで <title> 表示） */}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill={ACCENT}>
          <title>{`${p.label}: ${formatValue(p.value)}`}</title>
        </circle>
      ))}

      {/* 最新点の値を直接ラベル */}
      <text x={x(points.length - 1) + 8} y={y(last.value) + 4} fontSize={12} fontWeight={700} fill="currentColor" fillOpacity={0.85}>
        {formatValue(last.value)}
      </text>

      {/* x軸ラベル */}
      {xTickIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 12}
          textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.55}
        >
          {points[i].label}
        </text>
      ))}
    </svg>
  );
}
