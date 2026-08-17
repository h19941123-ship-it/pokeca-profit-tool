"use client";

// 為替レート入力欄＋「現在レート取得」ボタン。
// ボタンを押すと /api/fx から USD→JPY を取得して欄に反映する。
// 取得に失敗しても、手動入力した値はそのまま使える（フォールバック）。

import { useState } from "react";

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";

type FxApiResult =
  | { ok: true; rate: number; date: string; source: string }
  | { ok: false; error: string };

export function FxRateInput({
  name,
  defaultValue = "",
  label,
  hint,
  error,
}: {
  name: string;
  defaultValue?: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [info, setInfo] = useState("");

  async function fetchRate() {
    setStatus("loading");
    setInfo("");
    try {
      const res = await fetch("/api/fx", { cache: "no-store" });
      const data: FxApiResult = await res.json();
      if (data.ok) {
        setValue(String(data.rate));
        setStatus("idle");
        setInfo(`${data.date} 時点 / ${data.source}`);
      } else {
        setStatus("error");
        setInfo(data.error);
      }
    } catch {
      setStatus("error");
      setInfo("為替レートを取得できませんでした。手動で入力してください。");
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          placeholder="150"
        />
        <button
          type="button"
          onClick={fetchRate}
          disabled={status === "loading"}
          className="whitespace-nowrap rounded-md border border-black/15 px-3 py-2 text-xs hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.05]"
        >
          {status === "loading" ? "取得中..." : "現在レート取得"}
        </button>
      </div>
      {hint && <span className="text-xs text-black/50 dark:text-white/50">{hint}</span>}
      {info && (
        <span className={`text-xs ${status === "error" ? "text-red-600" : "text-black/50 dark:text-white/50"}`}>
          {info}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-600" role="alert">{error}</span>
      )}
    </label>
  );
}
