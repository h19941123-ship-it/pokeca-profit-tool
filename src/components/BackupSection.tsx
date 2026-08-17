"use client";

// バックアップ/復元。全データ(カード＋設定)を JSON でエクスポート、
// またはバックアップJSONを読み込んで復元する。

import { useState } from "react";

export function BackupSection() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを選び直せるようにリセット
    if (!file) return;
    if (!window.confirm("バックアップから復元します。同じIDのカードは上書きされます。よろしいですか？")) return;

    setStatus("loading");
    setMessage("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("done");
        setMessage(`復元しました（カード ${data.restoredCards} 件）。画面を再読み込みしてください。`);
      } else {
        setStatus("error");
        setMessage(data.error ?? "復元に失敗しました。");
      }
    } catch {
      setStatus("error");
      setMessage("ファイルを読み込めませんでした（JSON形式をご確認ください）。");
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-semibold">バックアップ / 復元</legend>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/backup"
          className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]"
        >
          バックアップを出力（JSON）
        </a>
        <label className="cursor-pointer rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]">
          {status === "loading" ? "復元中..." : "バックアップから復元"}
          <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} disabled={status === "loading"} />
        </label>
      </div>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>{message}</p>
      )}
      <p className="text-xs text-black/50 dark:text-white/50">
        全カードと設定を1つのJSONファイルに保存できます。機種変更やバックアップにご利用ください。
      </p>
    </fieldset>
  );
}
