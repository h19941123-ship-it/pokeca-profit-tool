// 404 ページ。

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        お探しのページは存在しないか、移動しました。
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        ダッシュボードへ
      </Link>
    </main>
  );
}
