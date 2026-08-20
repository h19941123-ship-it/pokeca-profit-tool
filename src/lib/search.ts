// 検索・絞り込みロジック。
//  - DB で絞れる項目（キーワード・仕入れ価格帯）は Prisma の where で。
//  - 計算値（利益率・利益額・仕入れ判定）は行を計算した後に JS で絞る。

import { Prisma } from "@/generated/prisma/client";
import type { Decision } from "@/lib/profit";
import type { CardRow } from "@/lib/dashboard";

/** 検索条件。未指定は undefined。 */
export interface SearchFilters {
  q?: string; // キーワード（カード名・番号・セット・レアリティ）
  minPrice?: number; // 仕入れ価格の下限（円）
  maxPrice?: number; // 仕入れ価格の上限（円）
  minRate?: number; // 利益率の下限(%)
  maxRate?: number; // 利益率の上限(%)
  minProfit?: number; // 利益額の下限（円）
  maxProfit?: number; // 利益額の上限（円）
  decision?: Decision; // 仕入れ判定
}

/** searchParams から1つの文字列を取り出す。 */
function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

/** 文字列を数値に（不正・空は undefined）。 */
function num(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** 判定文字列を安全に変換。 */
function toDecision(v: string | string[] | undefined): Decision | undefined {
  const s = first(v);
  return s === "BUY" || s === "CONSIDER" || s === "SKIP" || s === "UNSET" ? s : undefined;
}

/** searchParams を検索条件に変換する。 */
export function parseFilters(sp: Record<string, string | string[] | undefined>): SearchFilters {
  return {
    q: first(sp.q),
    minPrice: num(sp.minPrice),
    maxPrice: num(sp.maxPrice),
    minRate: num(sp.minRate),
    maxRate: num(sp.maxRate),
    minProfit: num(sp.minProfit),
    maxProfit: num(sp.maxProfit),
    decision: toDecision(sp.decision),
  };
}

/**
 * DB で絞る条件（仕入れ価格帯）を Prisma where にする。
 * キーワードは大文字小文字を無視するため DB ではなく JS 側（applyComputedFilters）で照合する。
 */
export function buildWhere(f: SearchFilters): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};

  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    where.purchasePriceJpy = {
      ...(f.minPrice !== undefined ? { gte: f.minPrice } : {}),
      ...(f.maxPrice !== undefined ? { lte: f.maxPrice } : {}),
    };
  }

  return where;
}

/** キーワードがカードのいずれかの項目に含まれるか（大文字小文字を無視）。 */
function matchesKeyword(card: CardRow["card"], q: string): boolean {
  const needle = q.toLowerCase();
  return [card.name, card.cardNumber, card.setName, card.rarity, card.tags, card.supplier]
    .some((v) => (v ?? "").toLowerCase().includes(needle));
}

/** 計算値（利益率・利益額・判定）＋キーワードで行を絞る。 */
export function applyComputedFilters(rows: CardRow[], f: SearchFilters): CardRow[] {
  return rows.filter(({ card, profit }) => {
    // キーワード（大文字小文字を無視）
    if (f.q && !matchesKeyword(card, f.q)) return false;
    // 利益率フィルタ: 条件があるのに利益率が null（仕入れ0円）なら除外
    if (f.minRate !== undefined || f.maxRate !== undefined) {
      if (profit.profitRate === null) return false;
      if (f.minRate !== undefined && profit.profitRate < f.minRate) return false;
      if (f.maxRate !== undefined && profit.profitRate > f.maxRate) return false;
    }
    if (f.minProfit !== undefined && profit.profitJpy < f.minProfit) return false;
    if (f.maxProfit !== undefined && profit.profitJpy > f.maxProfit) return false;
    if (f.decision !== undefined && profit.decision !== f.decision) return false;
    return true;
  });
}

/** 検索条件が1つでも指定されているか（空状態メッセージの出し分け用）。 */
export function hasAnyFilter(f: SearchFilters): boolean {
  return Object.values(f).some((v) => v !== undefined);
}
