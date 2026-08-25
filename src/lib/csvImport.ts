// CSV/貼り付けテキストから複数カードをまとめて取り込むパーサ（純粋関数）。
// 列順: カード名, 仕入価格(円), 販売価格(USD), セット, 番号, レアリティ, 仕入先, タグ, 画像URL
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
  /** 画像URL（任意）。空なら画像なしで登録される。 */
  imageUrl: string | null;
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

/**
 * 表計算から貼り付けた数値を読む。
 *
 * Number() をそのまま使うと、桁区切り・通貨記号・全角数字がすべて NaN に
 * なって 0 に落ちる。しかも仕入 0 円は「まだ調べていない」の意味を持つため
 * (profit.ts の Decision.UNSET)、8,000円のつもりが未設定として静かに
 * 取り込まれ、取り込んだ本人も気づけない。
 *
 * スプレッドシート貼り付けは想定された使い方なので、そこで出る表記は
 * 読めるようにする。読めない値は 0 のままにする（空欄と同じ扱い）。
 */
function num(v: string | undefined): number {
  const raw = (v ?? "").trim();
  if (!raw) return 0;

  const normalized = raw
    // 全角数字・記号を半角へ
    .replace(/[０-９．，－]/g, (c) => "0123456789.,-"["０１２３４５６７８９．，－".indexOf(c)])
    // 通貨記号と桁区切り、単位の空白を落とす
    .replace(/[¥$€£,\s]/g, "");

  const n = Number(normalized);
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
      imageUrl: str(f[8]),
    });
  }
  return { cards, total, skipped };
}
