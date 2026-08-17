// eBay マーケットプレイスの定義（複数マーケット対応の下準備）。
// クライアント・サーバー共通で使えるよう env に依存しない純粋データにする。

export interface Marketplace {
  id: string; // eBay の Marketplace ID（X-EBAY-C-MARKETPLACE-ID）
  label: string; // 画面表示名
  currency: string; // 主要通貨（表示の目安）
}

/** 対応マーケット一覧。必要に応じて追加できる。 */
export const MARKETPLACES: Marketplace[] = [
  { id: "EBAY_US", label: "アメリカ (US)", currency: "USD" },
  { id: "EBAY_GB", label: "イギリス (UK)", currency: "GBP" },
  { id: "EBAY_DE", label: "ドイツ (DE)", currency: "EUR" },
  { id: "EBAY_AU", label: "オーストラリア (AU)", currency: "AUD" },
  { id: "EBAY_CA", label: "カナダ (CA)", currency: "CAD" },
];

/** 既定のマーケット（env 未指定時のフォールバック）。 */
export const DEFAULT_MARKETPLACE_ID = "EBAY_US";

/** 有効な Marketplace ID か。 */
export function isValidMarketplace(id: string | null | undefined): boolean {
  return MARKETPLACES.some((m) => m.id === id);
}

/** 安全な Marketplace ID に正規化（不正なら既定）。 */
export function toMarketplaceId(id: string | null | undefined): string {
  return isValidMarketplace(id) ? (id as string) : DEFAULT_MARKETPLACE_ID;
}

/** Marketplace ID から定義を取得（無ければ undefined）。 */
export function getMarketplace(id: string): Marketplace | undefined {
  return MARKETPLACES.find((m) => m.id === id);
}
