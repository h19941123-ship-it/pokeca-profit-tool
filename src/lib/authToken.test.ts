import { describe, it, expect } from "vitest";
import {
  createToken,
  verifyToken,
  isAuthEnabled,
  safeEqual,
  AUTH_DAYS,
} from "@/lib/authToken";

const PW = "correct-horse-battery";
const NOW = 1_700_000_000_000;

describe("createToken / verifyToken", () => {
  it("正しいパスワードで作ったトークンは検証を通る", () => {
    const t = createToken(PW, NOW);
    expect(verifyToken(t, PW, NOW)).toBe(true);
  });

  it("違うパスワードでは通らない", () => {
    const t = createToken(PW, NOW);
    expect(verifyToken(t, "wrong", NOW)).toBe(false);
  });

  it("期限が切れたら通らない", () => {
    const t = createToken(PW, NOW);
    const afterExpiry = NOW + (AUTH_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(verifyToken(t, PW, afterExpiry)).toBe(false);
  });

  it("期限内なら通る", () => {
    const t = createToken(PW, NOW);
    const beforeExpiry = NOW + (AUTH_DAYS - 1) * 24 * 60 * 60 * 1000;
    expect(verifyToken(t, PW, beforeExpiry)).toBe(true);
  });

  it("トークンにパスワードそのものが含まれない", () => {
    expect(createToken(PW, NOW)).not.toContain(PW);
  });

  it("署名を書き換えると通らない", () => {
    const t = createToken(PW, NOW);
    const [payload] = t.split(".");
    expect(verifyToken(`${payload}.deadbeef`, PW, NOW)).toBe(false);
  });

  it("期限だけ延ばしても署名が合わないので通らない", () => {
    const t = createToken(PW, NOW);
    const sig = t.slice(t.lastIndexOf(".") + 1);
    const forged = `${NOW + 99 * 24 * 3600 * 1000}.${sig}`;
    expect(verifyToken(forged, PW, NOW)).toBe(false);
  });

  it("空・不正な形式でも落ちない", () => {
    expect(verifyToken(undefined, PW, NOW)).toBe(false);
    expect(verifyToken("", PW, NOW)).toBe(false);
    expect(verifyToken("ゴミ", PW, NOW)).toBe(false);
    expect(verifyToken(".abc", PW, NOW)).toBe(false);
    expect(verifyToken(createToken(PW, NOW), "", NOW)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("一致・不一致を正しく返す", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("長さが違っても落ちない", () => {
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("isAuthEnabled", () => {
  it("パスワード未設定なら保護しない（ローカル運用）", () => {
    expect(isAuthEnabled(undefined)).toBe(false);
    expect(isAuthEnabled("")).toBe(false);
  });

  it("設定されていれば保護する", () => {
    expect(isAuthEnabled("x")).toBe(true);
  });
});
