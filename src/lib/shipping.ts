// =============================================================================
// 送料計算ロジック（既存 ebay-shipping-tool/src/shipping.js を TypeScript 移植）
//
// 用途が2つあるので混同しないこと:
//  (A) estimateShippingJpy() … 出品者が日本郵便に払う「実送料(円)」の見積もり。
//        → 利益計算(profit.ts)の shippingJpy 候補として使う。MVPで使用。
//  (B) calcUsShipping() … 買い手に請求する「DDP送料(USD)」= 郵便実送料 + 関税立替 + バッファ。
//        → eBay 出品時に buyer へ請求する額。将来の eBay 連携で使用。
//
// 料金は 2026.6.1 改定の実データ（日本郵便 国際エアパケット 米国宛・第4地帯）。
// ※ 料金・関税は改定されうるため、実運用前に最新の公式情報を確認すること。
// =============================================================================

/** 国際エアパケット・米国(第4地帯)の重量別料金(円)。[上限重量g, 料金円]。 */
export const AIRPACKET_US_YEN: ReadonlyArray<readonly [number, number]> = [
  [100, 1200],
  [200, 1410],
  [300, 1620],
  [400, 1830],
  [500, 2040],
  [600, 2250],
  [700, 2460],
  [800, 2670],
  [900, 2880],
  [1000, 3090],
];

/** 重量(g)から米国宛エアパケット料金(円)を返す。該当帯がなければ最大帯。 */
export function airpacketUsYen(weightGrams: number): number {
  const w = Number.isFinite(weightGrams) ? weightGrams : 0;
  for (const [maxG, yen] of AIRPACKET_US_YEN) {
    if (w <= maxG) return yen;
  }
  return AIRPACKET_US_YEN[AIRPACKET_US_YEN.length - 1][1];
}

/**
 * (A) 出品者が支払う実送料(円)の見積もり。利益計算の shippingJpy 候補。
 * MVP では米国宛エアパケットの郵便料金をそのまま返す。
 * 生カード1枚 ≈ 100g、鑑定スラブ ≈ 250g。
 */
export function estimateShippingJpy(weightGrams = 100): number {
  return airpacketUsYen(weightGrams);
}

/** calcUsShipping の入力。 */
export interface UsShippingParams {
  priceUsd: number; // 商品価格(USD)
  weightGrams?: number; // 梱包後重量(g)。既定100
  fxRate?: number; // 円/ドル。既定150
  tariffRate?: number; // 関税率。日本原産は0.125
  bufferUsd?: number; // 為替変動・少額処理のバッファ。既定1
}

/** calcUsShipping の内訳。 */
export interface UsShippingBreakdown {
  postalYen: number; // 郵便実送料(円)
  postalUsd: number; // 郵便実送料(USD換算)
  tariffUsd: number; // 関税立替(USD)
  bufferUsd: number; // バッファ(USD)
  zonosFeeUsd: number; // Zonos手数料(USD)。無料=0
  rawTotalUsd: number; // 切上げ前合計(USD)
}

/**
 * (B) 米国宛の請求送料(USD, 切上げ)を計算する（DDP＝関税立替込み）。
 * 将来の eBay 出品連携で「買い手に請求する送料」を決めるのに使う。
 */
export function calcUsShipping({
  priceUsd,
  weightGrams = 100,
  fxRate = 150,
  tariffRate = 0.125,
  bufferUsd = 1,
}: UsShippingParams): { shippingUsd: number; breakdown: UsShippingBreakdown } {
  const safeFx = Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 150;
  const postalYen = airpacketUsYen(weightGrams);
  const postalUsd = postalYen / safeFx;
  const tariffUsd = (Number.isFinite(priceUsd) ? priceUsd : 0) * tariffRate;
  const raw = postalUsd + tariffUsd + bufferUsd;
  const shippingUsd = Math.ceil(raw);
  return {
    shippingUsd,
    breakdown: {
      postalYen,
      postalUsd: round2(postalUsd),
      tariffUsd: round2(tariffUsd),
      bufferUsd,
      zonosFeeUsd: 0,
      rawTotalUsd: round2(raw),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
