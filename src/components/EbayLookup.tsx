"use client";

// eBay 価格リサーチ。2つのモードを切り替えられる:
//   - 出品価格 (asking) … Browse API。今すぐ利用可能（App ID / Cert ID）。
//   - 実売価格 (sold)   … Marketplace Insights API。eBayの申請・審査が必要。
// 「最安/平均を販売価格に設定」で、フォーム内の販売価格(USD)入力へ反映する。
// 認証なし/未承認でも壊れず、案内を表示する。

import { useState } from "react";
import { MARKETPLACES, DEFAULT_MARKETPLACE_ID } from "@/lib/marketplaces";

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";

interface Summary {
  count: number;
  min: number;
  max: number;
  avg: number;
  currency: string;
}
interface DisplayItem {
  title: string;
  priceValue: number;
  currency: string;
  url: string | null;
  sub: string | null; // 出品=コンディション / 実売=落札日
}

type Mode = "asking" | "sold";
type Status = "idle" | "loading" | "done" | "error" | "no_credentials" | "not_approved";

function setSellPrice(value: number) {
  const el = document.querySelector<HTMLInputElement>('input[name="sellPriceUsd"]');
  if (el) {
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function EbayLookup({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [mode, setMode] = useState<Mode>("asking");
  const [marketplace, setMarketplace] = useState(DEFAULT_MARKETPLACE_ID);
  const [query, setQuery] = useState(defaultQuery);
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [message, setMessage] = useState("");

  function reset() {
    setStatus("idle");
    setSummary(null);
    setItems([]);
    setMessage("");
  }

  async function search() {
    const q = query.trim();
    if (!q) {
      setStatus("error");
      setMessage("カード名などのキーワードを入力してください。");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const endpoint = mode === "asking" ? "/api/ebay" : "/api/ebay/sold";
      const res = await fetch(
        `${endpoint}?q=${encodeURIComponent(q)}&marketplace=${encodeURIComponent(marketplace)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (data.ok) {
        const raw: Array<Record<string, unknown>> = mode === "asking" ? data.listings : data.items;
        const mapped: DisplayItem[] = (raw ?? []).slice(0, 5).map((r) => ({
          title: String(r.title ?? ""),
          priceValue: Number(r.priceValue),
          currency: String(r.currency ?? "USD"),
          url: (r.url as string) ?? null,
          sub: mode === "asking" ? ((r.condition as string) ?? null) : formatDate(r.soldDate as string),
        }));
        setSummary(data.summary);
        setItems(mapped);
        setStatus("done");
        if (!data.summary) setMessage("該当するデータが見つかりませんでした。");
      } else if (data.reason === "no_credentials") {
        setStatus("no_credentials");
      } else if (data.reason === "not_approved") {
        setStatus("not_approved");
      } else {
        setStatus("error");
        setMessage(data.error ?? "取得に失敗しました。");
      }
    } catch {
      setStatus("error");
      setMessage("検索に失敗しました。時間をおいて再度お試しください。");
    }
  }

  return (
    <div className="rounded-md border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]">
      <div className="mb-1 text-sm font-semibold">eBay 価格リサーチ（参考）</div>

      {/* モード切り替え */}
      <div className="mb-2 inline-flex rounded-md border border-black/15 p-0.5 text-xs dark:border-white/20">
        <ModeButton active={mode === "asking"} onClick={() => { setMode("asking"); reset(); }}>
          出品価格
        </ModeButton>
        <ModeButton active={mode === "sold"} onClick={() => { setMode("sold"); reset(); }}>
          実売価格
        </ModeButton>
      </div>

      <p className="mb-3 text-xs text-black/50 dark:text-white/50">
        {mode === "asking"
          ? "eBayの「出品中の価格」を検索します。※ 実際の落札額ではありません。"
          : "eBayの「落札実績（実売価格）」を検索します。※ Marketplace Insights は申請・審査が必要です。"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
          aria-label="マーケット"
          className={`${inputClass} w-auto`}
        >
          {MARKETPLACES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} min-w-[160px] flex-1`}
          placeholder="Charizard ex SAR など"
        />
        <button
          type="button"
          onClick={search}
          disabled={status === "loading"}
          className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "loading" ? "検索中..." : mode === "asking" ? "出品価格を調べる" : "実売価格を調べる"}
        </button>
      </div>

      {/* 認証なし */}
      {status === "no_credentials" && (
        <Guide>
          eBay APIの認証情報が未設定です。<code>.env</code> に <code>EBAY_APP_ID</code> と{" "}
          <code>EBAY_CERT_ID</code> を設定すると利用できます（手順は README を参照）。
        </Guide>
      )}

      {/* 実売：申請未承認 */}
      {status === "not_approved" && (
        <Guide>
          実売価格（落札実績）の取得には eBay <b>Marketplace Insights API</b> の
          <b>申請・承認</b>が必要です（Limited Release）。
          <br />
          <a
            href="https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            申請ページ・概要（developer.ebay.com）
          </a>
          <br />
          承認されると本ツールでそのまま実売価格を取得できます。それまでは「出品価格」をご利用ください。
        </Guide>
      )}

      {status === "error" && <div className="mt-3 text-xs text-red-600" role="alert">{message}</div>}

      {/* 集計結果 */}
      {status === "done" && summary && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="件数" value={`${summary.count}`} />
            <Stat label="最安" value={`${summary.currency} ${summary.min}`} />
            <Stat label="平均" value={`${summary.currency} ${summary.avg}`} />
            <Stat label="最高" value={`${summary.currency} ${summary.max}`} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-black/50 dark:text-white/50">販売価格(USD)に反映:</span>
            <button type="button" onClick={() => setSellPrice(summary.min)} className="rounded border border-black/15 px-2 py-1 hover:bg-black/[0.03] dark:border-white/20">最安</button>
            <button type="button" onClick={() => setSellPrice(summary.avg)} className="rounded border border-black/15 px-2 py-1 hover:bg-black/[0.03] dark:border-white/20">平均</button>
          </div>
          {items.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs">
              {items.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate text-black/70 dark:text-white/70">
                    {l.title}
                    {l.sub && <span className="ml-1 text-black/40 dark:text-white/40">({l.sub})</span>}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {l.currency} {l.priceValue}
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">開く</a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === "done" && !summary && message && (
        <div className="mt-3 text-xs text-black/50 dark:text-white/50">{message}</div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={active ? "rounded bg-blue-600 px-3 py-1 font-medium text-white" : "rounded px-3 py-1 text-black/70 dark:text-white/70"}
    >
      {children}
    </button>
  );
}

function Guide({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-2 dark:bg-black/20">
      <div className="text-[10px] text-black/50 dark:text-white/50">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

/** ISO日付を YYYY-MM-DD に（無効なら null）。 */
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
