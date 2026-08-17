// 軽量ロガー。コンソール出力に加えて logs/app.log へ追記する。
// ログ保存自体が失敗してもアプリを落とさない（すべて握りつぶす）。

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type Level = "info" | "warn" | "error";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

/** エラーメタを文字列化（Error はメッセージ＋スタックに展開）。 */
function stringifyMeta(meta: unknown): string {
  if (meta === undefined) return "";
  if (meta instanceof Error) return ` | ${meta.name}: ${meta.message}\n${meta.stack ?? ""}`;
  try {
    return ` | ${JSON.stringify(meta)}`;
  } catch {
    return ` | ${String(meta)}`;
  }
}

/** ファイルへ追記（失敗しても無視）。 */
async function writeToFile(line: string): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, line + "\n", "utf8");
  } catch {
    // ログの書き込み失敗はアプリ動作に影響させない
  }
}

function log(level: Level, message: string, meta?: unknown) {
  const time = new Date().toISOString();
  const line = `[${time}] [${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);

  // 非同期で追記（待たない）
  void writeToFile(line);
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};
