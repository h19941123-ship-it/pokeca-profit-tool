// タグ（DB には「カンマ区切りの1カラム」で保存）の取り扱い。
// 全角カンマ・読点でも区切れるようにして、入力のブレを吸収する。

/** タグ文字列を配列に分解する（空要素・重複は除去、順序は入力順）。 */
export function splitTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags.split(/[,、，]/)) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
