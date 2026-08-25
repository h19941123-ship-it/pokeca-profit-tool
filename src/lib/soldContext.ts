// 売却時点の手数料・為替条件のスナップショット。
//
// なぜ必要か:
//   実現損益（売れた分の利益）は、これまで毎回「現在の設定」で計算し直して
//   いた。設定を1つ触るだけで先月の実績が動く。実測すると、同じ1枚の実現利益が
//   ¥5,240 → ¥5,748（既定レートを150→155）、→ ¥4,880（eBay手数料13→15%）
//   のように±10%以上ずれた。例外は出ない。金額だけが静かに変わる。
//
//   「先月いくら儲かったか」は過去の事実であって、今の設定で決まる値ではない。
//   売却を確定した時点の条件をカードに焼き付け、以後はそれで計算する。
//
// predictedSellUsd（売る前の見込み価格）が既に同じ考え方で固定されている。
// これはその手数料版。

import type { ProfitInputs } from "@/lib/profit";

/** 売却時点で固定する条件（仕入れ・販売価格を除いた計算前提）。 */
export type SoldContext = Omit<ProfitInputs, "purchasePriceJpy" | "sellPriceUsd">;

const NUMERIC_KEYS = [
  "shippingChargedUsd",
  "fxRate",
  "shippingJpy",
  "ebayFeePct",
  "ebayFixedFeeUsd",
  "paymentFeePct",
  "fxFeePct",
  "tariffRatePct",
  "packingJpy",
  "otherFeeJpy",
  "thresholdBuyPct",
  "thresholdConsiderPct",
  "minProfitJpy",
] as const satisfies readonly (keyof SoldContext)[];

/**
 * DB の Json 列を SoldContext として読む。
 * 欠けた項目が1つでもあれば null を返す — 一部だけ現在の設定で埋めると、
 * 「固定された値」と「今の値」が混ざった数字になり、どちらとも言えなくなる。
 */
export function parseSoldContext(value: unknown): SoldContext | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;

  const out = {} as Record<string, number>;
  for (const key of NUMERIC_KEYS) {
    const n = o[key];
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    out[key] = n;
  }
  return out as SoldContext;
}

/** 保存用に数値だけを抜き出す（余計な項目を DB に持ち込まない）。 */
export function toStoredSoldContext(inputs: SoldContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of NUMERIC_KEYS) out[key] = inputs[key];
  return out;
}

/**
 * 更新後に保存すべきスナップショットを決める。
 *
 *  - 売却済になった時点で、そのときの条件を固定する
 *  - 一度固定したら上書きしない。売却後に設定を変えても実績は動かない
 *  - 売却済から戻したら破棄する（また売るときの条件で取り直す）
 */
export function nextSoldContext(args: {
  current: unknown; // いま保存されているスナップショット
  nextStatus: string;
  feeBase: SoldContext; // 現在の設定から組み立てた条件
}): Record<string, number> | null {
  if (args.nextStatus !== "SOLD") return null;

  const existing = parseSoldContext(args.current);
  if (existing) return toStoredSoldContext(existing);

  return toStoredSoldContext(args.feeBase);
}
