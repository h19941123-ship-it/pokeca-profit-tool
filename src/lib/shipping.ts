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

// =============================================================================
// (C) まとめ発送（同梱）の按分
//
// カードは軽いので、複数枚を1つの封筒に入れても重量帯がほとんど変わらない。
// 例) 100g 1枚=¥1,200 / 100g×5枚=500g=¥2,040 → 1枚あたり¥408。
// 1枚ずつ送る前提で計算すると送料を約3倍に見積もることになり、
// 実際には利益が出るカードを「見送り」と判定してしまう。
// =============================================================================

/** 料金表の上限重量(g)。これを超える荷物は1個口では送れない前提で扱う。 */
export const AIRPACKET_MAX_GRAMS =
  AIRPACKET_US_YEN[AIRPACKET_US_YEN.length - 1][0];

/**
 * 送料(円)から梱包後重量(g)を逆算する。
 * 重量が未入力で送料だけ手入力されているカードのために、
 * 「その額で送れる最小の重量帯」を代用の重量として返す。
 * 料金表の上限を超える額（エアパケット以外の手段）は null。
 */
export function impliedWeightGrams(shippingJpy: number): number | null {
  if (!Number.isFinite(shippingJpy) || shippingJpy <= 0) return null;
  for (const [maxG, yen] of AIRPACKET_US_YEN) {
    if (shippingJpy <= yen) return maxG;
  }
  return null;
}

/** まとめ発送の内訳。画面で「なぜこの送料なのか」を説明するために全部返す。 */
export interface BundledShipping {
  perCardJpy: number; // 按分後の1枚あたり送料（利益計算で使う額）
  bundleJpy: number; // 1回の発送にかかる送料の合計
  soloJpy: number; // 1枚だけで送った場合の送料（比較用）
  cards: number; // 実際にまとめられた枚数
  requested: number; // 設定上の希望枚数
  capped: boolean; // 重量上限で枚数を減らしたか
}

/**
 * まとめ発送したときの1枚あたり送料を求める。
 *
 * 重量は「カードの入力値 → 送料からの逆算」の順に決める。どちらも分からない場合は
 * 按分せず元の送料を返す。割り引いた額を勝手に使うと利益を過大に見せてしまうため、
 * 不明なときは安全側（1枚ずつ送る前提）に倒す。
 */
export function bundleShipping(
  shippingJpy: number,
  weightGrams: number | null | undefined,
  bundleCards: number,
): BundledShipping {
  const solo = Math.max(0, Math.round(Number.isFinite(shippingJpy) ? shippingJpy : 0));
  const requested = Math.max(1, Math.floor(Number.isFinite(bundleCards) ? bundleCards : 1) || 1);
  const none: BundledShipping = {
    perCardJpy: solo,
    bundleJpy: solo,
    soloJpy: solo,
    cards: 1,
    requested,
    capped: false,
  };
  if (requested <= 1 || solo <= 0) return none;

  const unit =
    weightGrams && weightGrams > 0 ? weightGrams : impliedWeightGrams(solo);
  if (!unit) return none; // 重量不明 → 按分しない

  // 1個口に収まる枚数で頭打ちにする。超過分は別便になり送料が別途かかるため。
  const fit = Math.floor(AIRPACKET_MAX_GRAMS / unit);
  const cards = Math.max(1, Math.min(requested, fit));
  if (cards <= 1) return none;

  const bundleJpy = airpacketUsYen(unit * cards);
  return {
    perCardJpy: Math.round(bundleJpy / cards),
    bundleJpy,
    soloJpy: solo,
    cards,
    requested,
    capped: cards < requested,
  };
}
