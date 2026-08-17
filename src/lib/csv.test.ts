import { describe, it, expect } from "vitest";
import { escapeCell, toCsv } from "./csv";

describe("escapeCell", () => {
  it("通常の値はそのまま", () => {
    expect(escapeCell("リザードン")).toBe("リザードン");
    expect(escapeCell(1200)).toBe("1200");
  });
  it("null/undefined は空文字", () => {
    expect(escapeCell(null)).toBe("");
    expect(escapeCell(undefined)).toBe("");
  });
  it("カンマ・改行・引用符を含む値は囲んでエスケープ", () => {
    expect(escapeCell("a,b")).toBe('"a,b"');
    expect(escapeCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("BOM 付き・CRLF 区切りでヘッダーと行を出力", () => {
    const csv = toCsv(["名前", "価格"], [["カード,A", 100]]);
    expect(csv.startsWith("﻿")).toBe(true); // Excel 用 BOM
    expect(csv).toContain("名前,価格");
    expect(csv).toContain('"カード,A",100');
    expect(csv).toContain("\r\n");
  });
});
