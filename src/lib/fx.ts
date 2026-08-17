// 為替レート取得（USD → JPY）。
// 既定は Frankfurter API（無料・APIキー不要・ECBデータ）。
// 取得は必ず失敗しうる前提。呼び出し側は失敗時に手動値へフォールバックする。
//
// 環境変数 FX_API_BASE_URL で別プロバイダに差し替え可能（将来拡張）。

import { logger } from "@/lib/logger";

const DEFAULT_BASE = "https://api.frankfurter.app";
const TIMEOUT_MS = 5000;

/** 取得結果（成功 or 失敗）。 */
export type FxResult =
  | { ok: true; rate: number; date: string; source: string }
  | { ok: false; error: string };

/**
 * Frankfurter のレスポンス JSON から USD→JPY レートと日付を取り出す純粋関数。
 * 想定形: { amount, base:"USD", date:"YYYY-MM-DD", rates: { JPY: number } }
 */
export function extractJpyRate(json: unknown): { rate: number; date: string } | null {
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;
  const rates = obj.rates;
  if (typeof rates !== "object" || rates === null) return null;
  const jpy = (rates as Record<string, unknown>).JPY;
  const date = typeof obj.date === "string" ? obj.date : "";
  if (typeof jpy !== "number" || !Number.isFinite(jpy) || jpy <= 0) return null;
  return { rate: jpy, date };
}

/**
 * 現在の USD→JPY レートを取得する。
 * ネットワーク/タイムアウト/不正レスポンス時は { ok:false } を返す（例外は投げない）。
 */
export async function fetchUsdJpyRate(): Promise<FxResult> {
  const base = process.env.FX_API_BASE_URL || DEFAULT_BASE;
  const url = `${base.replace(/\/$/, "")}/latest?from=USD&to=JPY`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `為替APIがエラーを返しました (HTTP ${res.status})` };
    }
    const json = await res.json();
    const parsed = extractJpyRate(json);
    if (!parsed) {
      return { ok: false, error: "為替APIの応答を解釈できませんでした" };
    }
    // 小数第2位に丸める
    const rate = Math.round(parsed.rate * 100) / 100;
    return { ok: true, rate, date: parsed.date, source: "Frankfurter (ECB)" };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn("為替レート取得に失敗", err);
    return {
      ok: false,
      error: isAbort
        ? "為替APIがタイムアウトしました"
        : "為替レートを取得できませんでした（ネットワークをご確認ください）",
    };
  } finally {
    clearTimeout(timer);
  }
}
