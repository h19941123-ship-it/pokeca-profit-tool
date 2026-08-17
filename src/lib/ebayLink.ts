// eBay 検索ページへのディープリンクを組み立てる純粋関数。
// APIキー不要・規約準拠（公式サイトの検索URLに飛ばすだけ）。
// スクレイピングはしない。カード名は呼び出し側で英語化してから渡す想定。

import { DEFAULT_MARKETPLACE_ID } from "@/lib/marketplaces";

/** Marketplace ID → eBay ドメイン。未対応は US にフォールバック。 */
const DOMAINS: Record<string, string> = {
  EBAY_US: "www.ebay.com",
  EBAY_GB: "www.ebay.co.uk",
  EBAY_DE: "www.ebay.de",
  EBAY_AU: "www.ebay.com.au",
  EBAY_CA: "www.ebay.ca",
};

/** Pokémon シングルカードのカテゴリID（US）。他ドメインでは付けない。 */
const US_POKEMON_SINGLES_CAT = "183454";

export interface EbayLinkOptions {
  sold?: boolean; // true=売却済(完了リスト), false=出品中
  marketplace?: string; // Marketplace ID（既定 EBAY_US）
}

/**
 * eBay 検索結果ページのURLを組み立てる。
 * @param query 検索語（英語化済みのカード名を推奨）
 * @returns 検索URL。query が空なら null。
 */
export function buildEbaySearchUrl(
  query: string,
  { sold = false, marketplace = DEFAULT_MARKETPLACE_ID }: EbayLinkOptions = {},
): string | null {
  const q = query.trim();
  if (!q) return null;

  const domain = DOMAINS[marketplace] ?? DOMAINS[DEFAULT_MARKETPLACE_ID];
  const params = new URLSearchParams({ _nkw: q });

  // US はポケモンシングルに絞る（カテゴリIDはドメイン依存のため US 限定）。
  if (domain === DOMAINS.EBAY_US) params.set("_sacat", US_POKEMON_SINGLES_CAT);

  if (sold) {
    params.set("LH_Sold", "1");
    params.set("LH_Complete", "1");
  }

  return `https://${domain}/sch/i.html?${params.toString()}`;
}
