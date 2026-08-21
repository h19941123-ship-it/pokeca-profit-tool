// 小さな統計ヘルパー。相場の判定でも予想の精度でも同じものが要るので1か所に置く。

/**
 * 中央値。外れ値1件で結論が変わらないよう、平均ではなくこちらを使う。
 * eBay の検索結果には状態の悪い品・別カード・まとめ売りが混ざるため、
 * 平均は高額出品に、最安は粗悪品に引きずられる。
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 変化率(%)。基準が0以下なら比べられないので null。 */
export function changePct(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return ((to - from) / from) * 100;
}
