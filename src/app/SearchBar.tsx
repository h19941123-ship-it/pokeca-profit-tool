// 検索バー（GET フォーム）。送信するとクエリ文字列になり、
// サーバーコンポーネント（ダッシュボード）がそれを読んで絞り込む。
// JS 不要（プログレッシブ）。現在のソートは hidden で保持する。

import Link from "next/link";
import type { SearchFilters } from "@/lib/search";
import { KeywordField } from "@/app/KeywordField";

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";
const labelClass = "flex flex-col gap-1 text-xs text-black/60 dark:text-white/60";

export function SearchBar({
  filters,
  sort,
  dir,
}: {
  filters: SearchFilters;
  sort: string;
  dir: string;
}) {
  return (
    <form
      method="get"
      action="/"
      className="mb-5 rounded-md border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]"
    >
      {/* 並べ替えを保持 */}
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KeywordField defaultValue={filters.q ?? ""} />

        <label className={labelClass}>
          仕入れ判定
          <select name="decision" defaultValue={filters.decision ?? ""} className={inputClass}>
            <option value="">すべて</option>
            <option value="BUY">仕入れ候補</option>
            <option value="CONSIDER">検討</option>
            <option value="SKIP">見送り</option>
            <option value="UNSET">未設定</option>
          </select>
        </label>

        <RangeField label="仕入れ価格（円）" minName="minPrice" maxName="maxPrice" min={filters.minPrice} max={filters.maxPrice} />
        <RangeField label="利益率（%）" minName="minRate" maxName="maxRate" min={filters.minRate} max={filters.maxRate} />
        <RangeField label="利益額（円）" minName="minProfit" maxName="maxProfit" min={filters.minProfit} max={filters.maxProfit} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          検索
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          クリア
        </Link>
      </div>
    </form>
  );
}

/** 下限〜上限の数値入力ペア。 */
function RangeField({
  label,
  minName,
  maxName,
  min,
  max,
}: {
  label: string;
  minName: string;
  maxName: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className={labelClass}>
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          name={minName}
          defaultValue={min ?? ""}
          className={inputClass}
          placeholder="下限"
          aria-label={`${label} 下限`}
        />
        <span className="text-black/40">〜</span>
        <input
          type="number"
          name={maxName}
          defaultValue={max ?? ""}
          className={inputClass}
          placeholder="上限"
          aria-label={`${label} 上限`}
        />
      </div>
    </div>
  );
}
