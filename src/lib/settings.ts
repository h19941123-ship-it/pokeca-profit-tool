// 全体設定（手数料率・判定しきい値など）へのアクセス。
// 設定は 1 行だけ（id = 1）。存在しなければスキーマの既定値で自動作成する。
// これにより「設定行が無い」状態でもアプリがクラッシュしない。

import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Settings } from "@/generated/prisma/client";

const SETTINGS_ID = 1;

/**
 * 設定を取得する。無ければ既定値で作成して返す。
 */
export async function getSettings(): Promise<Settings> {
  // better-sqlite3 は同期的に結果を返すため、これが無いとビルド時の
  // プリレンダリングで設定値が焼き込まれ、設定を変えても画面に反映されない
  // （/settings・/reports・/cards/new が静的ページ扱いになる）。
  await connection();
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID }, // 残りの項目は schema.prisma の @default が入る
  });
}

/**
 * 設定を更新する（部分更新）。無ければ作成してから更新する。
 */
export async function updateSettings(
  data: Partial<Omit<Settings, "id" | "updatedAt">>,
): Promise<Settings> {
  await getSettings(); // 行の存在を保証
  return prisma.settings.update({
    where: { id: SETTINGS_ID },
    data,
  });
}
