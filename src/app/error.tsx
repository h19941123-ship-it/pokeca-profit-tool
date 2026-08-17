"use client";

// ルートのエラーバウンダリ。想定外エラーでも白画面にせず、
// 分かりやすいメッセージと再試行ボタンを出す。

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // クライアント側にも記録（サーバーログには別途 logger が出力）
    console.error("画面でエラーが発生しました:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-bold">問題が発生しました</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        画面の表示中にエラーが発生しました。もう一度お試しください。
        繰り返す場合はサーバーのログ（logs/app.log）をご確認ください。
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          再試行
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
