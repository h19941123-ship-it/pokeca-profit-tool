// Prisma クライアントのシングルトン。
// Next.js の開発モードはホットリロードでモジュールを何度も読み込むため、
// 毎回 new PrismaClient() すると接続が増え続けて警告が出る。
// globalThis にキャッシュして 1 インスタンスだけ使い回す。
//
// Prisma 7 は「driver adapter」方式。SQLite は better-sqlite3 アダプタを使う。
// 接続先は環境変数 DATABASE_URL（.env、既定 "file:./dev.db"）から読む。
// DEMO_MODE=1 のときだけ /tmp のデモ用DBに切り替わる（src/lib/demoDb.ts）。

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveDatabaseUrl } from "@/lib/demoDb";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
