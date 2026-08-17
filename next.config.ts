import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // デモ用のシードDBはコードから import されないため、そのままだと
  // Vercel のデプロイに含まれない。全ルートに同梱するよう明示する。
  // （DEMO_MODE=1 のとき src/lib/demoDb.ts がこれを /tmp にコピーして使う）
  outputFileTracingIncludes: {
    "/*": ["prisma/demo.db"],
  },
};

export default nextConfig;
