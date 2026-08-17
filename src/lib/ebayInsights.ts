// eBay Marketplace Insights API クライアント（実売価格＝落札実績を取得）。
//
// 重要:
//  - これは「実売価格(sold)」。Browse API の「出品価格(asking)」とは別物。
//  - Marketplace Insights は Limited Release（申請・審査が必要）。
//    承認されると OAuth トークンに buy.marketplace.insights スコープが付与される。
//  - 未承認だとトークン要求が invalid_scope で失敗する → not_approved として案内する。
//  - 認証情報が無ければ no_credentials。いずれもアプリは壊さない。
//
// 環境変数は ebay.ts と共通（EBAY_APP_ID / EBAY_CERT_ID / EBAY_ENV / EBAY_MARKETPLACE_ID）。

import { logger } from "@/lib/logger";
import { hasEbayCredentials, type PriceSummary } from "@/lib/ebay";
import { toMarketplaceId } from "@/lib/marketplaces";

const TIMEOUT_MS = 8000;
const INSIGHTS_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";

function isProduction(): boolean {
  return (process.env.EBAY_ENV || "PRODUCTION").toUpperCase() !== "SANDBOX";
}
function apiBase(): string {
  return isProduction() ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}
function resolveMarketplace(override?: string): string {
  if (override) return toMarketplaceId(override);
  return toMarketplaceId(process.env.EBAY_MARKETPLACE_ID);
}

/** 1件の落札実績。 */
export interface SoldItem {
  title: string;
  priceValue: number; // 落札価格
  currency: string;
  soldDate: string | null; // 落札日（ISO文字列）
  url: string | null;
}

/** 実売検索の結果。 */
export type SoldSearchResult =
  | { ok: true; items: SoldItem[]; summary: PriceSummary | null; marketplace: string }
  | { ok: false; reason: "no_credentials" }
  | { ok: false; reason: "not_approved" } // 申請・審査が未完了
  | { ok: false; reason: "error"; error: string };

// トークンをメモリキャッシュ
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Insights スコープのアプリ用トークンを取得。未承認なら "not_approved"。 */
async function getInsightsToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: "not_approved" | "error" }
> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { ok: true, token: cachedToken.value };
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
      body: `grant_type=client_credentials&scope=${encodeURIComponent(INSIGHTS_SCOPE)}`,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok) {
      // スコープが未付与＝未承認
      if (json.error === "invalid_scope") return { ok: false, reason: "not_approved" };
      logger.warn("Insightsトークン取得に失敗", { status: res.status, error: json.error });
      return { ok: false, reason: "error" };
    }
    if (!json.access_token) return { ok: false, reason: "error" };
    cachedToken = { value: json.access_token, expiresAt: now + (json.expires_in ?? 7200) * 1000 };
    return { ok: true, token: cachedToken.value };
  } catch (err) {
    logger.warn("Insightsトークン取得で例外", err);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(timer);
  }
}

/** item_sales/search のレスポンスから落札実績を取り出す純粋関数。 */
export function parseSoldItems(json: unknown): SoldItem[] {
  if (typeof json !== "object" || json === null) return [];
  const sales = (json as Record<string, unknown>).itemSales;
  if (!Array.isArray(sales)) return [];
  const items: SoldItem[] = [];
  for (const it of sales) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    const price = o.lastSoldPrice as Record<string, unknown> | undefined;
    const value = price ? Number(price.value) : NaN;
    if (!Number.isFinite(value)) continue;
    items.push({
      title: typeof o.title === "string" ? o.title : "",
      priceValue: value,
      currency: price && typeof price.currency === "string" ? price.currency : "USD",
      soldDate: typeof o.lastSoldDate === "string" ? o.lastSoldDate : null,
      url: typeof o.itemWebUrl === "string" ? o.itemWebUrl : null,
    });
  }
  return items;
}

/** 落札実績から集計する純粋関数。 */
export function summarizeSold(items: SoldItem[]): PriceSummary | null {
  if (items.length === 0) return null;
  const values = items.map((i) => i.priceValue);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: items.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((sum / values.length) * 100) / 100,
    currency: items[0].currency,
  };
}

/** 実売価格（落札実績）を検索する。 */
export async function searchSoldItems(
  query: string,
  opts: { limit?: number; marketplace?: string } = {},
): Promise<SoldSearchResult> {
  const marketplace = resolveMarketplace(opts.marketplace);
  const limit = opts.limit ?? 20;
  if (!hasEbayCredentials()) return { ok: false, reason: "no_credentials" };
  const q = query.trim();
  if (!q) return { ok: true, items: [], summary: null, marketplace };

  const tok = await getInsightsToken();
  if (!tok.ok) {
    return tok.reason === "not_approved"
      ? { ok: false, reason: "not_approved" }
      : { ok: false, reason: "error", error: "eBay(実売)の認証に失敗しました。" };
  }

  const url =
    `${apiBase()}/buy/marketplace_insights/v1_beta/item_sales/search` +
    `?q=${encodeURIComponent(q)}&limit=${Math.min(Math.max(limit, 1), 50)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${tok.token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplace,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    // 403 はアクセス権未付与＝未承認扱い
    if (res.status === 403) return { ok: false, reason: "not_approved" };
    if (!res.ok) {
      return { ok: false, reason: "error", error: `eBay(実売)検索でエラー (HTTP ${res.status})` };
    }
    const json = await res.json();
    const items = parseSoldItems(json);
    return { ok: true, items, summary: summarizeSold(items), marketplace };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn("eBay(実売)検索に失敗", err);
    return {
      ok: false,
      reason: "error",
      error: isAbort ? "eBay(実売)検索がタイムアウトしました" : "eBay(実売)検索に失敗しました。",
    };
  } finally {
    clearTimeout(timer);
  }
}
