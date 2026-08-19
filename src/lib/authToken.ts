// パスワード保護のトークン生成・検証（純粋ロジック）。
//
// 個人用ツールを公開URLに置くための最小限の仕組み。利用者は本人1人なので、
// アカウント管理はせず「合言葉ひとつ」で守る。
//
// 設計:
//   - Cookie には生パスワードを入れず、HMAC-SHA256 の署名付きトークンを入れる
//     （Cookie を覗かれてもパスワードは復元できない）
//   - トークンに有効期限を埋め込み、期限切れは無効
//   - 比較は時間差が出ない方式（タイミング攻撃対策）
//
// Node の crypto を使うので Proxy（Node ランタイム）とサーバー側の両方で動く。

import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "pokeca_auth";

/** トークンの有効期間（日）。 */
export const AUTH_DAYS = 30;

/** 署名の材料。パスワードそのものを鍵に使う（別途 SECRET を管理しなくて済む）。 */
function sign(payload: string, password: string): string {
  return createHmac("sha256", password).update(payload).digest("hex");
}

/** 長さが違っても情報が漏れない比較。 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // 長さが違う時点で不一致だが、比較時間を揃えるためダミー比較を挟む
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** ログイン成功時に発行するトークン（"期限.署名" 形式）。 */
export function createToken(password: string, now: number = Date.now()): string {
  const expiresAt = now + AUTH_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, password)}`;
}

/** トークンが正しく、かつ期限内か。 */
export function verifyToken(
  token: string | undefined,
  password: string,
  now: number = Date.now(),
): boolean {
  if (!token || !password) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload, password))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/** パスワードが設定されているか（未設定なら保護をかけない＝ローカル運用）。 */
export function isAuthEnabled(password: string | undefined): password is string {
  return typeof password === "string" && password.length > 0;
}
