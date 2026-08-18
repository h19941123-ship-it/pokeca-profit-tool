"use client";

// Pokémon TCG API からカード情報を検索し、候補を選ぶとフォームに反映する。
// 反映先: name / cardNumber / setName / rarity / imageUrl（非制御 input に直接代入）。
// ※ 英語カードDBのため、検索は英語名（例: Charizard）が有効。

import { useState } from "react";
import { setInputValueByName } from "@/lib/setInputValue";

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";

interface TcgCard {
  id: string;
  name: string;
  number: string | null;
  setName: string | null;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
}

/** 名前付き input/textarea に値を入れる（非制御フォーム）。 */
function setField(name: string, value: string) {
  setInputValueByName(name, value);
}

export function CardInfoLookup({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [lang, setLang] = useState<"ja" | "en">("ja");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [message, setMessage] = useState("");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  function reset() {
    setStatus("idle");
    setCards([]);
    setMessage("");
    setAppliedId(null);
  }

  async function search() {
    const q = query.trim();
    if (!q) {
      setStatus("error");
      setMessage("カード名（英語）を入力してください。");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/pokemontcg?q=${encodeURIComponent(q)}&lang=${lang}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setCards(data.cards.slice(0, 12));
        setStatus("done");
        if (data.cards.length === 0) setMessage("該当するカードが見つかりませんでした（英語名でお試しください）。");
      } else {
        setStatus("error");
        setMessage(data.error ?? "取得に失敗しました。");
      }
    } catch {
      setStatus("error");
      setMessage("カード情報の取得に失敗しました。");
    }
  }

  function apply(c: TcgCard) {
    setField("name", c.name);
    if (c.number) setField("cardNumber", c.number);
    if (c.setName) setField("setName", c.setName);
    if (c.rarity) setField("rarity", c.rarity);
    if (c.imageLarge || c.imageSmall) setField("imageUrl", c.imageLarge ?? c.imageSmall ?? "");
    setAppliedId(c.id);
  }

  return (
    <div className="rounded-md border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]">
      <div className="mb-1 text-sm font-semibold">カード情報を自動取得（pokemontcg.io）</div>
      <p className="mb-2 text-xs text-black/50 dark:text-white/50">
        候補を選ぶと名前・番号・画像などを反映します。言語を選んで検索してください。
      </p>

      {/* 言語切り替え（結果の言語を固定して一貫させる） */}
      <div className="mb-2 inline-flex rounded-md border border-black/15 p-0.5 text-xs dark:border-white/20">
        <button type="button" onClick={() => { setLang("ja"); reset(); }} aria-pressed={lang === "ja"}
          className={lang === "ja" ? "rounded bg-blue-600 px-3 py-1 font-medium text-white" : "rounded px-3 py-1 text-black/70 dark:text-white/70"}>
          日本語
        </button>
        <button type="button" onClick={() => { setLang("en"); reset(); }} aria-pressed={lang === "en"}
          className={lang === "en" ? "rounded bg-blue-600 px-3 py-1 font-medium text-white" : "rounded px-3 py-1 text-black/70 dark:text-white/70"}>
          英語
        </button>
      </div>
      <p className="mb-3 text-[11px] text-black/40 dark:text-white/40">
        {lang === "ja"
          ? "日本語DB(TCGdex)。ポケモン・トレーナーズ・エネルギー。例: リザードンex / ハイパーボール"
          : "英語DB(pokemontcg)。高精細画像。日本語ポケモン名は自動で英語変換。例: Charizard ex"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} min-w-[160px] flex-1`}
          placeholder="リザードンex / Charizard ex など"
        />
        <button
          type="button"
          onClick={search}
          disabled={status === "loading"}
          className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "loading" ? "検索中..." : "カードを検索"}
        </button>
      </div>

      {status === "error" && <div className="mt-3 text-xs text-red-600" role="alert">{message}</div>}
      {status === "done" && cards.length === 0 && message && (
        <div className="mt-3 text-xs text-black/50 dark:text-white/50">{message}</div>
      )}

      {cards.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((c) => (
            <li key={c.id} className={`flex gap-2 rounded-md border p-2 ${appliedId === c.id ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : "border-black/10 dark:border-white/15"}`}>
              {c.imageSmall && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageSmall} alt={c.name} loading="lazy" className="h-16 w-auto rounded" />
              )}
              <div className="flex min-w-0 flex-col justify-between">
                <div className="truncate text-xs font-medium" title={c.name}>{c.name}</div>
                <div className="truncate text-[10px] text-black/50 dark:text-white/50">
                  {[c.setName, c.number, c.rarity].filter(Boolean).join(" / ")}
                </div>
                <button
                  type="button"
                  onClick={() => apply(c)}
                  className="mt-1 self-start rounded border border-black/15 px-2 py-0.5 text-[11px] hover:bg-black/[0.04] dark:border-white/20"
                >
                  {appliedId === c.id ? "反映済み" : "反映"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
