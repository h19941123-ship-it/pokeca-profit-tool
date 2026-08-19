// 合言葉を受け取ってログイン用Cookieを発行する。
// POST /api/login  { password }

import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_DAYS, createToken, isAuthEnabled, safeEqual } from "@/lib/authToken";

export async function POST(request: Request): Promise<Response> {
  const password = process.env.APP_PASSWORD;
  if (!isAuthEnabled(password)) {
    return NextResponse.json({ ok: false, error: "認証は設定されていません。" }, { status: 400 });
  }

  let input = "";
  try {
    const body = await request.json();
    input = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (!safeEqual(input, password)) {
    // 総当たりを少しでも遅くする（正誤どちらでも同じだけ待つ）
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: "合言葉が違います。" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, createToken(password), {
    httpOnly: true, // JavaScript から読めない＝盗まれにくい
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_DAYS * 24 * 60 * 60,
  });
  return res;
}

/** ログアウト。 */
export async function DELETE(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
