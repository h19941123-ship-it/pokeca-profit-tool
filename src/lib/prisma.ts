// Prisma クライアントのシングルトン。
//
// Prisma 7 は「driver adapter」方式。DB は PostgreSQL（Neon）で、
// 接続先は環境変数 DATABASE_URL から読む。
//
// 遅延生成にしている理由:
//   モジュールを読み込んだ時点で接続を作ると、DBを一切使わない処理
//   （純粋関数の単体テストなど）まで DATABASE_URL を要求してしまう。
//   実際にクエリを投げる瞬間まで生成を遅らせる。サーバーレスの
//   コールドスタートも軽くなる。
//
// Next.js の開発モードはホットリロードでモジュールを何度も読み込むため、
// globalThis にキャッシュして 1 インスタンスだけ使い回す。

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL が設定されていません。Vercel の環境変数、または手元の .env を確認してください。",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // サーバーレスでは関数が頻繁に起動・停止するため、接続は少なく short-lived に
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * 実際にプロパティへ触れた時点で初めて接続を作る。
 * 使い方は今までどおり `prisma.card.findMany()` のまま。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
