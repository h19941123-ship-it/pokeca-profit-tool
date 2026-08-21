// 小さな折れ線。相場の動きを一覧の中で一目で見せるためだけのもの。
// 目盛りは付けない（正確な値は数字で併記する）。

export function Sparkline({
  values,
  width = 96,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="text-[11px] text-black/30 dark:text-white/30">—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // 全部同じ値なら平坦に描く
  const stepX = width / (values.length - 1);
  const pad = 2;
  const usable = height - pad * 2;

  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(pad + usable - ((v - min) / span) * usable).toFixed(1)}`)
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? "stroke-green-600 dark:stroke-green-400" : "stroke-red-500"}
      />
    </svg>
  );
}
