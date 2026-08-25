// eBay Browse API クライアント（出品中の価格＝asking price を取得）。
//
// 重要:
//  - ここで取れるのは「出品中の価格」であり「実売価格(sold)」ではない。
//    実売価格は Marketplace Insights API（eBayの申請・審査が必要）が必要。
//  - 認証情報（App ID / Cert ID）が無い場合は例外を投げず no_credentials を返す
//    → 画面は取得方法を案内する（アプリは壊れない）。
//  - スクレイピングは規約違反のため行わない。API のみ。
//
// 必要な環境変数（.env）:
//   EBAY_APP_ID           … Client ID
//   EBAY_CERT_ID          … Client Secret
//   EBAY_ENV              … "PRODUCTION"（既定）or "SANDBOX"
//   EBAY_MARKETPLACE_ID   … 既定 "EBAY_US"

import { logger } from "@/lib/logger";
import { toMarketplaceId } from "@/lib/marketplaces";

const TIMEOUT_MS = 8000;
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function isProduction(): boolean {
  return (process.env.EBAY_ENV || "PRODUCTION").toUpperCase() !== "SANDBOX";
}
function apiBase(): string {
  return isProduction() ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}
/** 使用するマーケット: 引数優先 → env → 既定(EBAY_US)。不正値は既定に正規化。 */
function resolveMarketplace(override?: string): string {
  if (override) return toMarketplaceId(override);
  return toMarketplaceId(process.env.EBAY_MARKETPLACE_ID);
}

/** 1件の出品サマリ（画面表示に必要な最小項目）。 */
export interface EbayListing {
  title: string;
  priceValue: number; // 価格（数値）
  currency: string; // 通貨（例: USD）
  condition: string | null;
  url: string | null;
}

/** 出品価格の集計。 */
export interface PriceSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  /**
   * 中央値。相場の目安としては平均・最安より信頼できる。
   * 検索結果には状態の悪い品・別カード・まとめ売りが混ざるため、
   * 最安は外れ値を拾いやすく、平均も高額出品に引きずられる。
   */
  median: number;
  currency: string;
  /** 通貨が違うため集計から外した件数。0 以外なら表示側で断りを入れる。 */
  skipped: number;
}

/** 検索結果（成功 / 認証なし / エラー）。 */
export type EbaySearchResult =
  | { ok: true; listings: EbayListing[]; summary: PriceSummary | null; marketplace: string }
  | { ok: false; reason: "no_credentials" }
  | { ok: false; reason: "error"; error: string };

/** 認証情報が設定されているか。 */
export function hasEbayCredentials(): boolean {
  return Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
}

// アプリ用トークンをメモリにキャッシュ（有効期限付き）
let cachedToken: { value: string; expiresAt: number } | null = null;

/** OAuth クライアント認証でアプリ用アクセストークンを取得（キャッシュ利用）。 */
async function getAppToken(): Promise<string | null> {
  if (!hasEbayCredentials()) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`,
  ).toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}/identity/v1/oauth2/token`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn("eBayトークン取得に失敗", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedToken = {
      value: json.access_token,
      expiresAt: now + (json.expires_in ?? 7200) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    logger.warn("eBayトークン取得で例外", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Browse API のレスポンスから出品リストを取り出す純粋関数。 */
export function parseListings(json: unknown): EbayListing[] {
  if (typeof json !== "object" || json === null) return [];
  const summaries = (json as Record<string, unknown>).itemSummaries;
  if (!Array.isArray(summaries)) return [];
  const listings: EbayListing[] = [];
  for (const it of summaries) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    const price = o.price as Record<string, unknown> | undefined;
    const value = price ? Number(price.value) : NaN;
    if (!Number.isFinite(value)) continue;
    listings.push({
      title: typeof o.title === "string" ? o.title : "",
      priceValue: value,
      currency: price && typeof price.currency === "string" ? price.currency : "USD",
      condition: typeof o.condition === "string" ? o.condition : null,
      url: typeof o.itemWebUrl === "string" ? o.itemWebUrl : null,
    });
  }
  return listings;
}

/** 数値配列の中央値（偶数個なら中央2つの平均）。 */
export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(m * 100) / 100;
}

/**
 * 同じ通貨の価格だけを集計する。
 *
 * eBay は marketplace を指定しても出品者の設定通貨で返すことがあり、
 * 以前は先頭1件の通貨を代表として全件をそのまま平均していた。USD 2件に
 * JPY 1件（15,000円）が混ざるだけで「平均 $5,060」になり、しかも例外は
 * 出ない。件数が多い方の通貨だけを残し、落とした件数を skipped で返す。
 */
export function summarizeSameCurrency<T extends { priceValue: number; currency: string }>(
  items: T[],
): PriceSummary | null {
  if (items.length === 0) return null;

  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);
  const [currency] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const values = items.filter((i) => i.currency === currency).map((i) => i.priceValue);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((sum / values.length) * 100) / 100,
    median: medianOf(values),
    currency,
    skipped: items.length - values.length,
  };
}

/** 出品リストから最安・最高・平均・中央値・件数を集計する純粋関数。 */
export function summarizePrices(listings: EbayListing[]): PriceSummary | null {
  return summarizeSameCurrency(listings);
}

/**
 * 出品中の価格を検索する。
 * @param query 検索キーワード（カード名など）
 * @param limit 取得件数（既定 20）
 */
export async function searchActiveListings(
  query: string,
  opts: { limit?: number; marketplace?: string } = {},
): Promise<EbaySearchResult> {
  const marketplace = resolveMarketplace(opts.marketplace);
  const limit = opts.limit ?? 20;
  if (!hasEbayCredentials()) return { ok: false, reason: "no_credentials" };
  const q = query.trim();
  if (!q) return { ok: true, listings: [], summary: null, marketplace };

  const token = await getAppToken();
  if (!token) {
    return { ok: false, reason: "error", error: "eBayの認証に失敗しました。App ID / Cert ID をご確認ください。" };
  }

  const url =
    `${apiBase()}/buy/browse/v1/item_summary/search` +
    `?q=${encodeURIComponent(q)}` +
    `&limit=${Math.min(Math.max(limit, 1), 50)}` +
    `&filter=buyingOptions:%7BFIXED_PRICE%7D`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplace,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, reason: "error", error: `eBay検索でエラー (HTTP ${res.status})` };
    }
    const json = await res.json();
    const listings = parseListings(json);
    return {
      ok: true,
      listings,
      summary: summarizePrices(listings),
      marketplace,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn("eBay検索に失敗", err);
    return {
      ok: false,
      reason: "error",
      error: isAbort ? "eBay検索がタイムアウトしました" : "eBay検索に失敗しました（ネットワークをご確認ください）",
    };
  } finally {
    clearTimeout(timer);
  }
}
