// CSV 生成ユーティリティ。
// - カンマ・改行・ダブルクォートを含む値は "..." で囲み、内部の " は "" にエスケープ。
// - 先頭に BOM を付けると Excel が UTF-8 として正しく開く（日本語文字化け対策）。

/** 1 セルを CSV 用にエスケープする。 */
export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** ヘッダー行＋データ行から CSV 文字列を作る（BOM 付き）。 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const BOM = "﻿";
  const lines = [headers, ...rows].map((cols) => cols.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}
