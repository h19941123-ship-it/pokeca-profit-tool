// 設定フォームのバリデーション。
// 手数料率は画面では「%」で入力し、保存時に小数（0.13）へ変換する。
// 判定しきい値・既定為替・梱包費などはそのまま検証する。

import { z } from "zod";
import type { FieldErrors } from "@/lib/validation";

/** % 入力（0〜100）。 */
const percent = (label: string) =>
  z.coerce
    .number({ error: `${label}を数値で入力してください` })
    .min(0, `${label}は0以上で入力してください`)
    .max(100, `${label}は100以下で入力してください`);

/** 0以上の整数（円）。 */
const yenInt = (label: string) =>
  z.coerce
    .number({ error: `${label}を数値で入力してください` })
    .int(`${label}は整数（円）で入力してください`)
    .min(0, `${label}は0以上で入力してください`);

/** 設定フォームのスキーマ（入力は % のまま受け取る）。 */
export const settingsFormSchema = z.object({
  ebayFeePctInput: percent("eBay手数料率"),
  ebayFixedFeeUsd: z.coerce
    .number({ error: "eBay定額手数料を数値で入力してください" })
    .min(0, "eBay定額手数料は0以上で入力してください"),
  paymentFeePctInput: percent("決済手数料率"),
  fxFeePctInput: percent("為替手数料率"),
  tariffRatePctInput: percent("関税率"),
  packingJpy: yenInt("梱包費"),
  otherFeeJpy: yenInt("その他手数料"),
  defaultFxRate: z.coerce
    .number({ error: "既定の為替レートを数値で入力してください" })
    .positive("既定の為替レートは0より大きい値で入力してください"),
  thresholdBuyPct: z.coerce
    .number({ error: "仕入れ候補しきい値を数値で入力してください" })
    .min(0, "仕入れ候補しきい値は0以上で入力してください"),
  thresholdConsiderPct: z.coerce
    .number({ error: "検討しきい値を数値で入力してください" })
    .min(0, "検討しきい値は0以上で入力してください"),
  minProfitJpy: yenInt("最低利益額"),
  minExportGainJpy: yenInt("海外に出す最低差額"),
  notifyProfitRatePct: percent("通知する利益率"),
  notifyPriceChangePct: percent("通知する価格変動率"),
  gradingFeeRegularUsd: z.coerce
    .number({ error: "レギュラー鑑定料を数値で入力してください" })
    .min(0, "レギュラー鑑定料は0以上で入力してください"),
  gradingFeeExpressUsd: z.coerce
    .number({ error: "エクスプレス鑑定料を数値で入力してください" })
    .min(0, "エクスプレス鑑定料は0以上で入力してください"),
  gradingShipJpy: yenInt("鑑定の往復送料"),
  gradingAgentJpy: yenInt("代行手数料"),
});

/** DB に保存する形（手数料は小数に変換済み）。 */
export interface SettingsUpdate {
  ebayFeePct: number;
  ebayFixedFeeUsd: number;
  paymentFeePct: number;
  fxFeePct: number;
  tariffRatePct: number;
  packingJpy: number;
  otherFeeJpy: number;
  defaultFxRate: number;
  thresholdBuyPct: number;
  thresholdConsiderPct: number;
  minProfitJpy: number;
  minExportGainJpy: number;
  notifyProfitRatePct: number;
  notifyPriceChangePct: number;
  gradingFeeRegularUsd: number;
  gradingFeeExpressUsd: number;
  gradingShipJpy: number;
  gradingAgentJpy: number;
}

export type SettingsParseResult =
  | { success: true; data: SettingsUpdate }
  | { success: false; fieldErrors: FieldErrors };

/** FormData を検証し、保存用データ（手数料は小数）に変換する。 */
export function parseSettingsForm(formData: FormData): SettingsParseResult {
  const raw = {
    ebayFeePctInput: formData.get("ebayFeePctInput"),
    ebayFixedFeeUsd: formData.get("ebayFixedFeeUsd"),
    paymentFeePctInput: formData.get("paymentFeePctInput"),
    fxFeePctInput: formData.get("fxFeePctInput"),
    tariffRatePctInput: formData.get("tariffRatePctInput"),
    packingJpy: formData.get("packingJpy"),
    otherFeeJpy: formData.get("otherFeeJpy"),
    defaultFxRate: formData.get("defaultFxRate"),
    thresholdBuyPct: formData.get("thresholdBuyPct"),
    thresholdConsiderPct: formData.get("thresholdConsiderPct"),
    minProfitJpy: formData.get("minProfitJpy"),
    minExportGainJpy: formData.get("minExportGainJpy"),
    notifyProfitRatePct: formData.get("notifyProfitRatePct"),
    notifyPriceChangePct: formData.get("notifyPriceChangePct"),
    gradingFeeRegularUsd: formData.get("gradingFeeRegularUsd"),
    gradingFeeExpressUsd: formData.get("gradingFeeExpressUsd"),
    gradingShipJpy: formData.get("gradingShipJpy"),
    gradingAgentJpy: formData.get("gradingAgentJpy"),
  };

  const result = settingsFormSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { success: false, fieldErrors };
  }

  const v = result.data;
  return {
    success: true,
    data: {
      // % → 小数に変換
      ebayFeePct: v.ebayFeePctInput / 100,
      ebayFixedFeeUsd: v.ebayFixedFeeUsd,
      paymentFeePct: v.paymentFeePctInput / 100,
      fxFeePct: v.fxFeePctInput / 100,
      tariffRatePct: v.tariffRatePctInput, // 関税は%のまま保存
      packingJpy: v.packingJpy,
      otherFeeJpy: v.otherFeeJpy,
      defaultFxRate: v.defaultFxRate,
      thresholdBuyPct: v.thresholdBuyPct,
      thresholdConsiderPct: v.thresholdConsiderPct,
      minProfitJpy: v.minProfitJpy,
      minExportGainJpy: v.minExportGainJpy,
      notifyProfitRatePct: v.notifyProfitRatePct,
      notifyPriceChangePct: v.notifyPriceChangePct,
      gradingFeeRegularUsd: v.gradingFeeRegularUsd,
      gradingFeeExpressUsd: v.gradingFeeExpressUsd,
      gradingShipJpy: v.gradingShipJpy,
      gradingAgentJpy: v.gradingAgentJpy,
    },
  };
}
