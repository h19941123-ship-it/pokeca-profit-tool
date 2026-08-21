"use server";

// 相場ウォッチの登録・削除・停止再開・手動更新。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { collectDue, collectOne } from "@/lib/watchCollect";
import { MARKETPLACES, DEFAULT_MARKETPLACE_ID } from "@/lib/marketplaces";
import { logger } from "@/lib/logger";

export interface WatchFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** 監視対象を追加する。追加直後に1回観測しておく（すぐ数字が出るように）。 */
export async function addWatchAction(
  _prev: WatchFormState,
  formData: FormData,
): Promise<WatchFormState> {
  const label = str(formData.get("label"));
  const query = str(formData.get("query"));
  const marketplaceId = str(formData.get("marketplaceId")) || DEFAULT_MARKETPLACE_ID;

  if (!label) return { status: "error", message: "名前を入れてください。" };
  if (!query) return { status: "error", message: "eBayの検索キーワードを入れてください。" };
  if (!MARKETPLACES.some((m) => m.id === marketplaceId)) {
    return { status: "error", message: "対応していないマーケットです。" };
  }

  try {
    const watch = await prisma.watch.create({
      data: { label, query, marketplaceId, note: str(formData.get("note")) || null },
    });
    const first = await collectOne(watch);
    revalidatePath("/watch");
    if (!first.ok) {
      return {
        status: "success",
        message: `「${label}」を登録しました。ただし今回は観測できませんでした（${first.reason}）。検索キーワードを見直してください。`,
      };
    }
    return { status: "success", message: `「${label}」を登録しました。出品${first.listingCount}件・中央値 $${first.medianUsd}。` };
  } catch (err) {
    logger.error("相場ウォッチの登録に失敗", err);
    return { status: "error", message: "登録に失敗しました。" };
  }
}

/** 監視対象を削除する（観測の記録も一緒に消える）。 */
export async function deleteWatchAction(formData: FormData): Promise<void> {
  const id = Number(str(formData.get("id")));
  if (!Number.isInteger(id)) return;
  try {
    await prisma.watch.delete({ where: { id } });
    revalidatePath("/watch");
  } catch (err) {
    logger.error("相場ウォッチの削除に失敗", err);
  }
}

/** 監視の一時停止・再開。記録は消さない。 */
export async function toggleWatchAction(formData: FormData): Promise<void> {
  const id = Number(str(formData.get("id")));
  if (!Number.isInteger(id)) return;
  try {
    const w = await prisma.watch.findUnique({ where: { id }, select: { active: true } });
    if (!w) return;
    await prisma.watch.update({ where: { id }, data: { active: !w.active } });
    revalidatePath("/watch");
  } catch (err) {
    logger.error("相場ウォッチの停止切替に失敗", err);
  }
}

/** いま全部取り直す。間隔の制限を無視するので、押したときだけ使う。 */
export async function refreshWatchesAction(): Promise<void> {
  try {
    await collectDue({ force: true, max: 50 });
    revalidatePath("/watch");
  } catch (err) {
    logger.error("相場ウォッチの一括更新に失敗", err);
  }
}
