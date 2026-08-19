"use client";

// カード入力フォーム（新規登録・編集の共通コンポーネント）。
// action（createCard / updateCard）と初期値 defaults を差し替えて使い回す。

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  initialCardFormState,
  type CardFormState,
} from "@/app/cards/formState";
import { FxRateInput } from "@/components/FxRateInput";
import { EbayLookup } from "@/components/EbayLookup";
import { CardInfoLookup } from "@/components/CardInfoLookup";
import { LiveProfitPreview } from "@/components/LiveProfitPreview";
import { estimateShippingJpy } from "@/lib/shipping";
import { setInputValueByName } from "@/lib/setInputValue";
import { yen, pct } from "@/lib/format";
import {
  computePreview,
  type ProfitSettings,
  type PreviewResult,
} from "@/lib/previewProfit";

/** 重量(g)から日本郵便の送料(円)を計算して対象欄に入れる。 */
function fillShippingFromWeight(targetName: string, weightGrams: number) {
  setInputValueByName(targetName, estimateShippingJpy(weightGrams));
}

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";

/** フォーム各項目の初期値（すべて文字列。id があれば編集モード）。 */
export interface CardFieldDefaults {
  id?: number;
  name?: string;
  cardNumber?: string;
  setName?: string;
  rarity?: string;
  language?: string;
  condition?: string;
  imageUrl?: string;
  purchasePriceJpy?: string;
  domesticBuybackJpy?: string;
  supplier?: string;
  purchasedAt?: string;
  stock?: string;
  sellPriceUsd?: string;
  shippingChargedUsd?: string;
  fxRate?: string;
  shippingJpy?: string;
  gradedShippingJpy?: string;
  weightGrams?: string;
  psa10SellUsd?: string;
  psa9SellUsd?: string;
  psa10Prob?: string;
  gradingPlan?: string;
  status?: string;
  soldPriceUsd?: string;
  soldAt?: string;
  notes?: string;
  tags?: string;
}

type CardAction = (
  state: CardFormState,
  formData: FormData,
) => Promise<CardFormState>;

function Field(props: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {props.label}
        {props.required && <span className="text-red-600"> *</span>}
      </span>
      {props.children}
      {props.hint && (
        <span className="text-xs text-black/50 dark:text-white/50">{props.hint}</span>
      )}
      {props.error && (
        <span className="text-xs text-red-600" role="alert">{props.error}</span>
      )}
    </label>
  );
}

export function CardForm({
  action,
  defaults = {},
  submitLabel = "カードを登録",
  resetOnSuccess = false,
  settings,
}: {
  action: CardAction;
  defaults?: CardFieldDefaults;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  /** 手数料・しきい値。渡すと入力中のライブ判定を表示する。 */
  settings: ProfitSettings;
}) {
  const [state, formAction, pending] = useActionState<CardFormState, FormData>(
    action,
    initialCardFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  // フォームは非制御なので、入力のたびに FormData を読み直して計算し直す。
  // （各項目を useState にすると外部から値を差し込む既存処理と噛み合わないため）
  const recompute = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const get = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" ? v : null;
    };
    setPreview(
      computePreview(
        {
          purchasePriceJpy: get("purchasePriceJpy"),
          sellPriceUsd: get("sellPriceUsd"),
          shippingChargedUsd: get("shippingChargedUsd"),
          fxRate: get("fxRate"),
          shippingJpy: get("shippingJpy"),
        },
        settings,
      ),
    );
  }, [settings]);

  // 初期表示（編集時は既存値）と、保存後のリセット・再描画のたびに計算。
  useEffect(() => {
    recompute();
  }, [recompute, state]);

  useEffect(() => {
    if (state.status === "success" && resetOnSuccess) {
      formRef.current?.reset();
      recompute();
    }
  }, [state, resetOnSuccess, recompute]);

  const d = defaults;

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={recompute}
      onChange={recompute}
      className="flex flex-col gap-6"
    >
      {d.id !== undefined && <input type="hidden" name="id" value={d.id} />}

      {/* 入力中のライブ判定（保存しなくても仕入れ可否がわかる） */}
      {preview && <LiveProfitPreview preview={preview} />}

      {/* 成功メッセージ＋利益プレビュー */}
      {state.status === "success" && state.created && (
        <div className="rounded-md border border-green-600/40 bg-green-50 p-4 text-sm dark:bg-green-950/30">
          <p className="font-medium text-green-800 dark:text-green-300">✅ {state.message}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <PreviewItem label="予想利益" value={yen(state.created.profitJpy)} />
            <PreviewItem label="利益率" value={pct(state.created.profitRate)} />
            <PreviewItem label="仕入れ判定" value={state.created.decisionLabel} />
            <PreviewItem label="おすすめ度" value={`${state.created.score} / 100`} />
          </div>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            ※ 価格変動があるため、これは入力値に基づく「予想」です。
          </p>
        </div>
      )}

      {/* 全体エラー */}
      {state.status === "error" && (
        <div className="rounded-md border border-red-600/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {state.message}
        </div>
      )}

      {/* --- カード情報 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">カード情報</legend>
        <CardInfoLookup defaultQuery={d.name ?? ""} />
        <Field label="カード名" required error={errors.name}>
          <input name="name" className={inputClass} placeholder="ピカチュウ" defaultValue={d.name ?? ""} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="カード番号" error={errors.cardNumber}>
            <input name="cardNumber" className={inputClass} placeholder="025/165" defaultValue={d.cardNumber ?? ""} />
          </Field>
          <Field label="セット名" error={errors.setName}>
            <input name="setName" className={inputClass} placeholder="151" defaultValue={d.setName ?? ""} />
          </Field>
          <Field label="レアリティ" error={errors.rarity}>
            <input name="rarity" className={inputClass} placeholder="SAR" defaultValue={d.rarity ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="言語" error={errors.language} hint="JP / EN など">
            <input name="language" className={inputClass} defaultValue={d.language ?? "JP"} />
          </Field>
          <Field label="コンディション" error={errors.condition} hint="NM / LP / PSA10 など">
            <input name="condition" className={inputClass} defaultValue={d.condition ?? "NM"} />
          </Field>
          <Field label="画像URL" error={errors.imageUrl}>
            <input name="imageUrl" className={inputClass} placeholder="https://..." defaultValue={d.imageUrl ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="タグ" error={errors.tags} hint="カンマ区切り（例: 151, 高額, カードラッシュ）">
            <input name="tags" className={inputClass} placeholder="151, 高額" defaultValue={d.tags ?? ""} />
          </Field>
          <Field label="メモ" error={errors.notes}>
            <input name="notes" className={inputClass} placeholder="状態や仕入条件など" defaultValue={d.notes ?? ""} />
          </Field>
        </div>
      </fieldset>

      {/* --- 仕入れ情報 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">仕入れ情報</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="仕入れ価格（円）" required error={errors.purchasePriceJpy}>
            <input name="purchasePriceJpy" type="number" min="0" step="1" className={inputClass} placeholder="5000" defaultValue={d.purchasePriceJpy ?? ""} />
          </Field>
          <Field label="仕入れ先" error={errors.supplier}>
            <input name="supplier" className={inputClass} placeholder="カードラッシュ" defaultValue={d.supplier ?? ""} />
          </Field>
          <Field
            label="国内買取額（円）"
            error={errors.domesticBuybackJpy}
            hint="買取チェッカー等で調べた「店が買い取る値段」"
          >
            <div className="flex items-center gap-2">
              <input
                name="domesticBuybackJpy"
                type="number"
                min="0"
                step="1"
                className={inputClass}
                placeholder="18000"
                defaultValue={d.domesticBuybackJpy ?? ""}
              />
              <button
                type="button"
                onClick={() => {
                  const v = document.querySelector<HTMLInputElement>('[name="domesticBuybackJpy"]')?.value;
                  if (v) setInputValueByName("purchasePriceJpy", v);
                }}
                className="whitespace-nowrap rounded-md border border-black/15 px-2 py-2 text-xs hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]"
                title="買取額を仕入れ値の目安として入れる（実際の仕入れ値はこれより高くなるのが普通です）"
              >
                仕入れ値に
              </button>
            </div>
          </Field>
          <Field label="購入日" error={errors.purchasedAt}>
            <input name="purchasedAt" type="date" className={inputClass} defaultValue={d.purchasedAt ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="在庫数" error={errors.stock}>
            <input name="stock" type="number" min="0" step="1" className={inputClass} defaultValue={d.stock ?? "1"} />
          </Field>
          <Field label="ステータス" error={errors.status}>
            <select name="status" className={inputClass} defaultValue={d.status ?? "STOCK"}>
              <option value="STOCK">仕入済</option>
              <option value="LISTED">出品中</option>
              <option value="SOLD">売却済</option>
            </select>
          </Field>
          <Field label="実売却額（USD）" error={errors.soldPriceUsd} hint="売却済のとき入力">
            <input name="soldPriceUsd" type="number" min="0" step="0.01" className={inputClass} placeholder="0" defaultValue={d.soldPriceUsd ?? "0"} />
          </Field>
          <Field label="売却日" error={errors.soldAt}>
            <input name="soldAt" type="date" className={inputClass} defaultValue={d.soldAt ?? ""} />
          </Field>
        </div>
      </fieldset>

      {/* --- 販売シナリオ --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">販売シナリオ（海外販売の想定）</legend>
        <EbayLookup defaultQuery={d.name ?? ""} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="販売価格（USD）" error={errors.sellPriceUsd} hint="商品本体の価格">
            <input name="sellPriceUsd" type="number" min="0" step="0.01" className={inputClass} placeholder="80" defaultValue={d.sellPriceUsd ?? "0"} />
          </Field>
          <Field label="購入者請求送料（USD）" error={errors.shippingChargedUsd} hint="購入者から受け取る送料。0=送料無料">
            <input name="shippingChargedUsd" type="number" min="0" step="0.01" className={inputClass} placeholder="0" defaultValue={d.shippingChargedUsd ?? "0"} />
          </Field>
          <FxRateInput
            name="fxRate"
            defaultValue={d.fxRate ?? ""}
            label="為替レート（円/USD）"
            hint="空欄なら設定の既定値を使用"
            error={errors.fxRate}
          />
          <Field label="重量（g）" error={errors.weightGrams} hint="素体≈100 / スラブ≈250">
            <input name="weightGrams" type="number" min="0" step="1" className={inputClass} placeholder="100" defaultValue={d.weightGrams ?? ""} />
          </Field>
          <Field label="国際送料（円・素体）" error={errors.shippingJpy}>
            <div className="flex items-center gap-2">
              <input name="shippingJpy" type="number" min="0" step="1" className={inputClass} placeholder="1200" defaultValue={d.shippingJpy ?? "0"} />
              <button
                type="button"
                onClick={() => fillShippingFromWeight("shippingJpy", Number(document.querySelector<HTMLInputElement>('[name="weightGrams"]')?.value) || 100)}
                className="whitespace-nowrap rounded-md border border-black/15 px-2 py-2 text-xs hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]"
                title="重量から日本郵便の送料を計算"
              >
                重量から計算
              </button>
            </div>
          </Field>
        </div>
      </fieldset>

      {/* --- PSA鑑定シナリオ --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">PSA鑑定シナリオ（任意）</legend>
        <p className="-mt-2 text-xs text-black/50 dark:text-white/50">
          素体を鑑定して売る想定。PSA価格を入れると詳細ページで「鑑定して売る」期待利益を計算します（鑑定料などは設定で調整）。
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="PSA10 販売価格（USD）" error={errors.psa10SellUsd}>
            <input name="psa10SellUsd" type="number" min="0" step="0.01" className={inputClass} placeholder="200" defaultValue={d.psa10SellUsd ?? "0"} />
          </Field>
          <Field label="PSA9以下 販売価格（USD）" error={errors.psa9SellUsd}>
            <input name="psa9SellUsd" type="number" min="0" step="0.01" className={inputClass} placeholder="60" defaultValue={d.psa9SellUsd ?? "0"} />
          </Field>
          <Field label="PSA10 になる確率（%）" error={errors.psa10Prob} hint="例: 40（過去の鑑定実績など）">
            <input name="psa10Prob" type="number" min="0" max="100" step="1" className={inputClass} placeholder="40" defaultValue={d.psa10Prob ?? "0"} />
          </Field>
          <Field label="スラブ送料（円）" error={errors.gradedShippingJpy} hint="0=素体送料を流用">
            <div className="flex items-center gap-2">
              <input name="gradedShippingJpy" type="number" min="0" step="1" className={inputClass} placeholder="1620" defaultValue={d.gradedShippingJpy ?? "0"} />
              <button
                type="button"
                onClick={() => fillShippingFromWeight("gradedShippingJpy", 250)}
                className="whitespace-nowrap rounded-md border border-black/15 px-2 py-2 text-xs hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.05]"
                title="スラブ(250g)の送料を計算"
              >
                スラブ計算
              </button>
            </div>
          </Field>
          <Field label="鑑定プラン" error={errors.gradingPlan} hint="鑑定料は設定のプラン別金額を使用">
            <select name="gradingPlan" className={inputClass} defaultValue={d.gradingPlan ?? "REGULAR"}>
              <option value="REGULAR">レギュラー</option>
              <option value="EXPRESS">エクスプレス</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "保存中..." : submitLabel}
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ダッシュボードへ
        </Link>
      </div>
    </form>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
