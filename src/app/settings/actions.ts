"use server";

// 設定更新の Server Action。バリデーション → 保存 → 一覧を再計算。

import { revalidatePath } from "next/cache";
import { parseSettingsForm } from "@/lib/settingsValidation";
import { updateSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";
import type { SettingsFormState } from "@/app/settings/formState";

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const parsed = parseSettingsForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "入力内容に誤りがあります。赤いメッセージをご確認ください。",
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    await updateSettings(parsed.data);
    // 設定変更は全カードの利益に影響するため一覧を再計算
    revalidatePath("/");
    return { status: "success", message: "設定を保存しました。" };
  } catch (err) {
    logger.error("設定の保存に失敗", err);
    return {
      status: "error",
      message: "保存中にエラーが発生しました。時間をおいて再度お試しください。",
    };
  }
}
