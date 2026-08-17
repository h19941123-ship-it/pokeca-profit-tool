// 在庫ステータスの表示ラベル（フォームの select と画面表示で同じ文言を使う）。

export type CardStatus = "STOCK" | "LISTED" | "SOLD";

export const STATUS_LABELS: Record<CardStatus, string> = {
  STOCK: "仕入済",
  LISTED: "出品中",
  SOLD: "売却済",
};

/** DB の文字列を安全にラベルへ（未知の値はそのまま返す）。 */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as CardStatus] ?? status;
}
