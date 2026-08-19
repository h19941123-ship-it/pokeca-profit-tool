// カード登録フォームの入力バリデーション（zod）。
// FormData の値はすべて文字列なので、数値・日付・空欄を安全に変換する。
// エラーは「フィールド名 → 日本語メッセージ」の形に整形して返す。

import { z } from "zod";

/** 空文字・null を undefined に変換（任意項目・既定値処理のため）。 */
const emptyToUndef = (v: unknown) =>
  v === "" || v === null ? undefined : v;

/** 任意の文字列（空欄は未入力扱い）。前後空白は除去。 */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.preprocess(emptyToUndef, z.string().optional()),
);

/** 任意の URL（空欄OK。入っていれば形式チェック）。 */
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.preprocess(emptyToUndef, z.url("URLの形式が正しくありません").optional()),
);

/** カード登録フォームのスキーマ。 */
export const cardFormSchema = z.object({
  // --- 基本情報 ---
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "カード名は必須です"),
  ),
  cardNumber: optionalString,
  setName: optionalString,
  rarity: optionalString,
  language: z.preprocess(emptyToUndef, z.string().default("JP")),
  condition: z.preprocess(emptyToUndef, z.string().default("NM")),
  imageUrl: optionalUrl,

  // --- 仕入れ情報 ---
  purchasePriceJpy: z.preprocess(
    emptyToUndef,
    z.coerce
      .number({ error: "仕入れ価格を数値で入力してください" })
      .int("仕入れ価格は整数（円）で入力してください")
      .min(0, "仕入れ価格は0以上で入力してください"),
  ),
  supplier: optionalString,
  domesticBuybackJpy: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "国内買取額を数値で入力してください" })
      .int("国内買取額は整数（円）で入力してください")
      .min(0, "国内買取額は0以上で入力してください"),
  ),
  purchasedAt: z.preprocess(
    emptyToUndef,
    z.coerce.date({ error: "購入日の形式が正しくありません" }).optional(),
  ),
  stock: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : v),
    z.coerce.number().int("在庫数は整数で入力してください").min(0, "在庫数は0以上で入力してください"),
  ),

  // --- 販売シナリオ ---
  sellPriceUsd: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "販売価格を数値で入力してください" })
      .min(0, "販売価格は0以上で入力してください"),
  ),
  fxRate: z.preprocess(
    emptyToUndef,
    z.coerce
      .number({ error: "為替レートを数値で入力してください" })
      .positive("為替レートは0より大きい値で入力してください")
      .optional(),
  ),
  shippingChargedUsd: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "購入者請求送料を数値で入力してください" })
      .min(0, "0以上で入力してください"),
  ),
  shippingJpy: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "送料を数値で入力してください" })
      .int("送料は整数（円）で入力してください")
      .min(0, "送料は0以上で入力してください"),
  ),
  gradedShippingJpy: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "スラブ送料を数値で入力してください" })
      .int("スラブ送料は整数（円）で入力してください")
      .min(0, "0以上で入力してください"),
  ),
  weightGrams: z.preprocess(
    emptyToUndef,
    z.coerce
      .number({ error: "重量を数値で入力してください" })
      .int("重量は整数（g）で入力してください")
      .positive("重量は0より大きい値で入力してください")
      .optional(),
  ),

  // --- PSA鑑定シナリオ ---
  psa10SellUsd: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number({ error: "PSA10販売価格を数値で入力してください" }).min(0, "0以上で入力してください"),
  ),
  psa9SellUsd: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number({ error: "PSA9販売価格を数値で入力してください" }).min(0, "0以上で入力してください"),
  ),
  psa10Prob: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "PSA10確率を数値で入力してください" })
      .min(0, "0以上で入力してください")
      .max(100, "100以下で入力してください"),
  ),
  gradingPlan: z.preprocess(
    (v) => (v === "EXPRESS" ? "EXPRESS" : "REGULAR"),
    z.enum(["REGULAR", "EXPRESS"]),
  ),

  // --- 販売ステータス・実績 ---
  status: z.preprocess(
    (v) => (v === "LISTED" || v === "SOLD" ? v : "STOCK"),
    z.enum(["STOCK", "LISTED", "SOLD"]),
  ),
  soldPriceUsd: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number({ error: "実売却額を数値で入力してください" }).min(0, "0以上で入力してください"),
  ),
  soldAt: z.preprocess(emptyToUndef, z.coerce.date({ error: "売却日の形式が正しくありません" }).optional()),

  // --- メモ・タグ ---
  notes: optionalString,
  tags: optionalString,
});

/** バリデーション済みのカード入力型。 */
export type CardInput = z.output<typeof cardFormSchema>;

/** フィールド別エラー（フィールド名 → 最初のメッセージ）。 */
export type FieldErrors = Record<string, string>;

/** パース結果（成功 or 失敗）。 */
export type ParseResult =
  | { success: true; data: CardInput }
  | { success: false; fieldErrors: FieldErrors };

/**
 * FormData をカード入力にパースする。
 * zod のエラーは「フィールド名 → 最初の日本語メッセージ」に整形する。
 */
export function parseCardForm(formData: FormData): ParseResult {
  const raw = {
    name: formData.get("name"),
    cardNumber: formData.get("cardNumber"),
    setName: formData.get("setName"),
    rarity: formData.get("rarity"),
    language: formData.get("language"),
    condition: formData.get("condition"),
    imageUrl: formData.get("imageUrl"),
    purchasePriceJpy: formData.get("purchasePriceJpy"),
    supplier: formData.get("supplier"),
    domesticBuybackJpy: formData.get("domesticBuybackJpy"),
    purchasedAt: formData.get("purchasedAt"),
    stock: formData.get("stock"),
    sellPriceUsd: formData.get("sellPriceUsd"),
    shippingChargedUsd: formData.get("shippingChargedUsd"),
    fxRate: formData.get("fxRate"),
    shippingJpy: formData.get("shippingJpy"),
    gradedShippingJpy: formData.get("gradedShippingJpy"),
    weightGrams: formData.get("weightGrams"),
    psa10SellUsd: formData.get("psa10SellUsd"),
    psa9SellUsd: formData.get("psa9SellUsd"),
    psa10Prob: formData.get("psa10Prob"),
    gradingPlan: formData.get("gradingPlan"),
    status: formData.get("status"),
    soldPriceUsd: formData.get("soldPriceUsd"),
    soldAt: formData.get("soldAt"),
    notes: formData.get("notes"),
    tags: formData.get("tags"),
  };

  const result = cardFormSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { success: false, fieldErrors };
}
