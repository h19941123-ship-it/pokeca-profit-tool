// ログイン画面。APP_PASSWORD が設定されているときだけ意味を持つ。

import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "ログイン | ポケカ利益判定ツール" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-xl font-bold">ポケカ 利益判定ツール</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        合言葉を入力してください。
      </p>
      <Suspense fallback={<p className="text-sm text-black/50">読み込み中…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
