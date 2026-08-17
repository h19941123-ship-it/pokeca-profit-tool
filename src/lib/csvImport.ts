// CSV/貼り付けテキストから複数カードをまとめて取り込むパーサ（純粋関数）。
// 列順: カード名, 仕入価格(円), 販売価格(USD), セット, 番号, レアリティ, 仕入先, タグ
// タブ区切り(スプレッドシート貼り付け)またはカンマ区切りに対応。ヘッダー行は自動スキップ。

export interface ImportCard {
  name: string;
  purchasePriceJpy: number;
  sellPriceUsd: number;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  supplier: string | null;
  tags: string | null;
}

export interface ImportResult {
  cards: ImportCard[];
  total: number; // 解釈した行数（ヘッダー除く）
  skipped: number; // カード名が空でスキップした行数
}

/** 1行をフィールドに分割（カンマ時は簡易的にクオートを尊重）。 */
function splitLine(line: string, delim: "\t" | ","): string[] {
  if (delim === "\t") return line.split("\t");
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined): number {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
function str(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

const HEADER_WORDS = ["カード名", "name", "名前"];

export function parseImportText(text: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { cards: [], total: 0, skipped: 0 };

  const delim: "\t" | "," = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  let start = 0;
  const firstCell = splitLine(lines[0], delim)[0]?.trim().toLowerCase() ?? "";
  if (HEADER_WORDS.some((w) => firstCell === w.toLowerCase())) start = 1;

  const cards: ImportCard[] = [];
  let skipped = 0;
  let total = 0;
  for (let i = start; i < lines.length; i++) {
    total++;
    const f = splitLine(lines[i], delim);
    const name = (f[0] ?? "").trim();
    if (!name) { skipped++; continue; }
    cards.push({
      name,
      purchasePriceJpy: Math.round(num(f[1])),
      sellPriceUsd: num(f[2]),
      setName: str(f[3]),
      cardNumber: str(f[4]),
      rarity: str(f[5]),
      supplier: str(f[6]),
      tags: str(f[7]),
    });
  }
  return { cards, total, skipped };
}
