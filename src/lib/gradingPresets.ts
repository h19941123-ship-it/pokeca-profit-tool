// PSA鑑定コストの料金プリセット（設定画面でワンクリック入力する目安値）。
//
// 注意:
//  - PSA本国(US)は USD、PSA Japan(国内)は 円 で料金体系が異なる。
//  - 鑑定料フィールドは USD なので、円建てプランは適用時に「現在の為替」で
//    USD へ換算して埋める（適用時点で正しい円額になる）。
//  - すべて 2026-08 時点の目安。料金・階層は改定されるため要確認。
//  - Value（最安）階層は US では一時停止中（2026-06〜）。

/** 料金の指定: USD 建て または 円建て。 */
export type FeeSpec = { usd: number } | { jpy: number };

export interface GradingPreset {
  id: string;
  label: string;
  note: string;
  regular: FeeSpec; // レギュラー相当の鑑定料
  express: FeeSpec; // エクスプレス相当の鑑定料
  shipJpy: number; // 往復送料（円）目安
  agentJpy: number; // 代行手数料（円）目安
}

export const GRADING_PRESETS: GradingPreset[] = [
  {
    id: "psa_us",
    label: "PSA 本国（US直接）",
    note: "2026-08時点の公表料金（Regular $79.99 / Express $149）。往復送料は国際便の目安。別途ハンドリング~$10・返送/保険$15〜・申告$499超は保険2%。",
    regular: { usd: 79.99 },
    express: { usd: 149 },
    shipJpy: 3000,
    agentJpy: 0,
  },
  {
    id: "agent_us",
    label: "代行業者（US提出）",
    note: "PSA US料金＋代行手数料の目安。手数料・送料は業者により変動するため要確認。",
    regular: { usd: 79.99 },
    express: { usd: 149 },
    shipJpy: 2000,
    agentJpy: 3000,
  },
  {
    id: "psa_japan",
    label: "PSA Japan（国内提出）",
    note: "国内・円建て（レギュラー¥11,980 / XP¥22,980、2026-08時点）。現在の為替でUSD換算して入力します。往復送料・梱包は別途。Value/Bulkは別階層。",
    regular: { jpy: 11980 },
    express: { jpy: 22980 },
    shipJpy: 2000,
    agentJpy: 0,
  },
];

/** FeeSpec を USD に解決する（円建ては現在の為替で換算）。 */
export function feeSpecToUsd(spec: FeeSpec, fxRate: number): number {
  if ("usd" in spec) return spec.usd;
  const fx = Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 150;
  return Math.round((spec.jpy / fx) * 100) / 100;
}
