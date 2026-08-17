// 公開デモ用のデータベース配置。
//
// Vercel などのサーバーレス環境はアプリのフォルダが読み取り専用で、
// 書き込めるのは /tmp だけ。しかも /tmp はインスタンスが入れ替わると消える。
// そこで DEMO_MODE=1 のときは
//   リポジトリに同梱した prisma/demo.db を /tmp にコピーして、そこを使う
// という形にする。
//
// この方式はデモにちょうど良い:
//   - 見に来た人が登録・編集・削除を実際に試せる（書き込みができる）
//   - 一定時間で自動的に初期状態へ戻る（荒らされても残らない）
//   - 外部のDBサービスの契約が要らない（無料で完結する）
//
// DEMO_MODE を設定しなければ何も起こらないので、手元の dev.db 運用は従来のまま。

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

/** 公開デモとして動かしているか。 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}

/** デモ用DBを /tmp に用意して、その接続URLを返す。 */
function prepareDemoDatabase(): string {
  const seed = path.join(process.cwd(), "prisma", "demo.db");
  const workDir = path.join(tmpdir(), "pokeca-demo");
  const working = path.join(workDir, "demo.db");

  if (!existsSync(working)) {
    mkdirSync(workDir, { recursive: true });
    // 同梱のシードが無ければ諦めて通常の DATABASE_URL に任せる
    if (!existsSync(seed)) {
      throw new Error(`デモ用のシードDBが見つかりません: ${seed}`);
    }
    copyFileSync(seed, working);
  }

  return `file:${working}`;
}

/** 実際に接続するデータベースURL。 */
export function resolveDatabaseUrl(): string {
  if (isDemoMode()) return prepareDemoDatabase();
  return process.env.DATABASE_URL ?? "file:./dev.db";
}
