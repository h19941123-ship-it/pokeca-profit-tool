"use client";

// 検索欄のキーワード入力。GETフォームの name="q" をそのまま担いつつ、
// 入力内容から eBay の検索結果ページへのリンクをその場で組み立てて表示する。
// APIキー不要・規約準拠（公式検索ページを新しいタブで開くだけ）。

import { useState } from "react";
import { translateCardQuery } from "@/lib/jpPokemonNames";
import { buildEbaySearchUrl } from "@/lib/ebayLink";

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";
const labelClass = "flex flex-col gap-1 text-xs text-black/60 dark:text-white/60";

export function KeywordField({
  defaultValue,
  marketplace = "EBAY_US",
}: {
  defaultValue: string;
  marketplace?: string;
}) {
  const [q, setQ] = useState(defaultValue);

  const { translated, didTranslate } = translateCardQuery(q);
  // eBay 検索語: 日本語が変換できたら英語名、無ければ入力そのまま。
  const term = translated.trim();
  const activeUrl = buildEbaySearchUrl(term, { sold: false, marketplace });
  const soldUrl = buildEbaySearchUrl(term, { sold: true, marketplace });

  return (
    <label className={`${labelClass} sm:col-span-2`}>
      キーワード（名前・番号・セット・レアリティ・タグ・仕入れ先）
      <input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={inputClass}
        placeholder="リザードン / 025 / 151 / SAR / 高額"
      />

      {/* eBay 出品情報リンク（入力があるときだけ表示） */}
      {activeUrl && soldUrl && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium text-black/70 dark:text-white/70">eBayで見る:</span>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            出品中 ↗
          </a>
          <a
            href={soldUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            売却済 ↗
          </a>
          {didTranslate && (
            <span className="text-black/45 dark:text-white/45">
              英語名: <span className="font-mono">{term}</span>
            </span>
          )}
        </div>
      )}
      <p className="text-[11px] text-black/40 dark:text-white/45">
        ※価格は eBay の公式検索で確認できます（実売は「売却済」）。表示額はすべて予想の参考です。
      </p>
    </label>
  );
}
