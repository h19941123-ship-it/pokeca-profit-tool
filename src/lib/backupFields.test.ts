// バックアップ→復元で項目が落ちないことを、スキーマと突き合わせて機械的に確認する。
//
// 実際に起きた不具合: バックアップは Card の全列を出力しているのに、復元側は
// 手書きのホワイトリストだったため status / soldAt / notes / tags などが
// 静かに捨てられていた。売却済みの記録が消えるとレポートの実現損益が壊れる。
//
// 列を追加したときに復元へ足し忘れると、このテストが落ちる。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "../..");

/** schema.prisma の指定モデルから、保存対象の列名を取り出す。 */
function columnsOf(model: string, skip: string[]): string[] {
  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const block = schema.split(`model ${model} {`)[1].split("\nmodel ")[0];
  const cols = [...block.matchAll(/^\s{2}(\w+)\s+\S/gm)].map((m) => m[1]);
  const drop = new Set(skip);
  return cols.filter((c) => !drop.has(c));
}

function cardColumns(): string[] {
  // 自動採番・タイムスタンプ・リレーションは復元対象外
  return columnsOf("Card", ["id", "createdAt", "updatedAt", "priceHistory"]);
}

function settingsColumns(): string[] {
  // 為替の自動更新はバックアップ時点の状態を持ち込まない（復元先の環境に任せる）
  return columnsOf("Settings", ["id", "updatedAt", "autoFxUpdate", "lastFxUpdatedAt"]);
}

/** restore の settings.update が埋めているキー。 */
function restoredSettingsKeys(): Set<string> {
  const src = readFileSync(path.join(root, "src/app/api/restore/route.ts"), "utf8");
  const block = src.split("where: { id: 1 },")[1].split("\n        },")[0];
  return new Set([...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
}

/** restore の data オブジェクトが埋めているキー。 */
function restoredKeys(): Set<string> {
  const src = readFileSync(path.join(root, "src/app/api/restore/route.ts"), "utf8");
  const block = src.split("const data = {")[1].split("\n      };")[0];
  const keys = [...block.matchAll(/^\s*(\w+)[:,]/gm)].map((m) => m[1]);
  return new Set(keys);
}

describe("バックアップ／復元の項目の対応", () => {
  it("Card の全列が復元で埋められている（取りこぼしがない）", () => {
    const missing = cardColumns().filter((c) => !restoredKeys().has(c));
    expect(missing).toEqual([]);
  });

  it("売却の記録が復元対象に含まれる（実現損益が消えないため）", () => {
    const keys = restoredKeys();
    for (const k of ["status", "soldPriceUsd", "soldAt"]) {
      expect(keys.has(k)).toBe(true);
    }
  });

  it("メモ・タグ・国内買取額も復元対象", () => {
    const keys = restoredKeys();
    for (const k of ["notes", "tags", "domesticBuybackJpy"]) {
      expect(keys.has(k)).toBe(true);
    }
  });

  it("Settings の全項目が復元で埋められている", () => {
    // 実際に起きた取りこぼし: minExportGainJpy（国内買取との比較しきい値）が
    // 復元対象から漏れていて、復元するたび既定値に戻っていた。
    const missing = settingsColumns().filter((c) => !restoredSettingsKeys().has(c));
    expect(missing).toEqual([]);
  });
});
