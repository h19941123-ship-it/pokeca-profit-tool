// 全リクエストの手前で動く認証ゲート。
//
// Next.js 16 では middleware.ts は proxy.ts に改名された（機能は同じ）。
//
// APP_PASSWORD が設定されているときだけ保護する:
//   - 未設定（手元の開発・デモ公開）→ 素通り。今までどおり動く
//   - 設定あり（クラウドの本番）    → 合言葉を知らないと何も見えない
//
// ページだけでなく API も守る。守り漏れがあると、画面は隠れていても
// /api/backup や /api/export から在庫データが丸ごと取れてしまう。

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthEnabled, verifyToken } from "@/lib/authToken";

/** 認証なしでも通す経路（ログイン画面と、その処理そのもの）。 */
const PUBLIC_PATHS = ["/login", "/api/login"];

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;

  // パスワード未設定なら保護しない（ローカル運用・公開デモ）
  if (!isAuthEnabled(password)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (verifyToken(request.cookies.get(AUTH_COOKIE)?.value, password)) {
    return NextResponse.next();
  }

  // API はリダイレクトせず 401 を返す（画面遷移用のHTMLを返しても意味がないため）
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  // ログイン後に元のページへ戻すため、行き先を持たせる
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // 静的ファイル・画像・アイコン類は除外（除外しないとCSSやJSまで止まる）
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)",
  ],
};
