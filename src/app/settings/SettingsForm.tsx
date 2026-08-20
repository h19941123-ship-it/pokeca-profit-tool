"use client";

// 設定フォーム（クライアント）。手数料は % で表示・入力する。

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveSettings } from "@/app/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/app/settings/formState";
import { FxRateInput } from "@/components/FxRateInput";
import { GRADING_PRESETS, feeSpecToUsd, type GradingPreset } from "@/lib/gradingPresets";
import { setInputValueByName } from "@/lib/setInputValue";

/** 名前付き input に値をセット（非制御フォーム）。 */
function setField(name: string, value: number) {
  setInputValueByName(name, value);
}

/** 手数料プリセット。 */
interface FeePreset {
  id: string; label: string;
  ebayPct: number; fixedUsd: number; paymentPct: number; fxPct: number; tariffPct: number;
}
const FEE_PRESETS: FeePreset[] = [
  { id: "us_tcg", label: "eBay トレカ US（13.25%＋$0.40）", ebayPct: 13.25, fixedUsd: 0.4, paymentPct: 0, fxPct: 1.35, tariffPct: 0 },
  { id: "us_tcg_ddp", label: "eBay US＋関税DDP(12.5%)", ebayPct: 13.25, fixedUsd: 0.4, paymentPct: 0, fxPct: 1.35, tariffPct: 12.5 },
  { id: "simple", label: "シンプル（13%のみ）", ebayPct: 13, fixedUsd: 0, paymentPct: 0, fxPct: 0, tariffPct: 0 },
];
function applyFeePreset(p: FeePreset) {
  setField("ebayFeePctInput", p.ebayPct);
  setField("ebayFixedFeeUsd", p.fixedUsd);
  setField("paymentFeePctInput", p.paymentPct);
  setField("fxFeePctInput", p.fxPct);
  setField("tariffRatePctInput", p.tariffPct);
}

/** 料金プリセットを適用（円建ては現在の為替でUSD換算して埋める）。 */
function applyGradingPreset(preset: GradingPreset) {
  const fxEl = document.querySelector<HTMLInputElement>('[name="defaultFxRate"]');
  const fx = fxEl ? Number(fxEl.value) : 150;
  setField("gradingFeeRegularUsd", feeSpecToUsd(preset.regular, fx));
  setField("gradingFeeExpressUsd", feeSpecToUsd(preset.express, fx));
  setField("gradingShipJpy", preset.shipJpy);
  setField("gradingAgentJpy", preset.agentJpy);
}

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-black/20";

/** 設定の初期値（サーバーから渡す。手数料は % に変換済み）。 */
export interface SettingsDefaults {
  ebayFeePctInput: number;
  ebayFixedFeeUsd: number;
  paymentFeePctInput: number;
  fxFeePctInput: number;
  tariffRatePctInput: number;
  packingJpy: number;
  otherFeeJpy: number;
  defaultFxRate: number;
  thresholdBuyPct: number;
  thresholdConsiderPct: number;
  minProfitJpy: number;
  minExportGainJpy: number;
  bundleCards: number;
  notifyProfitRatePct: number;
  notifyPriceChangePct: number;
  gradingFeeRegularUsd: number;
  gradingFeeExpressUsd: number;
  gradingShipJpy: number;
  gradingAgentJpy: number;
}

function Field(props: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
  suffix?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{props.label}</span>
      <div className="flex items-center gap-2">
        <input
          name={props.name}
          type="number"
          step={props.step ?? "1"}
          min="0"
          defaultValue={props.defaultValue}
          className={inputClass}
        />
        {props.suffix && (
          <span className="text-sm text-black/50 dark:text-white/50">{props.suffix}</span>
        )}
      </div>
      {props.hint && (
        <span className="text-xs text-black/50 dark:text-white/50">{props.hint}</span>
      )}
      {props.error && (
        <span className="text-xs text-red-600" role="alert">{props.error}</span>
      )}
    </label>
  );
}

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveSettings,
    initialSettingsFormState,
  );
  const e = state.fieldErrors ?? {};
  const [presetNote, setPresetNote] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.status === "success" && (
        <div className="rounded-md border border-green-600/40 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300" role="status">
          ✅ {state.message}
        </div>
      )}
      {state.status === "error" && (
        <div className="rounded-md border border-red-600/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {state.message}
        </div>
      )}

      {/* --- 手数料・経費 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">手数料・経費</legend>

        {/* 手数料プリセット */}
        <div className="rounded-md border border-black/10 bg-black/[0.02] p-3 dark:border-white/15 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-medium text-black/60 dark:text-white/60">手数料プリセット（目安・要確認）</div>
          <div className="flex flex-wrap gap-2">
            {FEE_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => applyFeePreset(p)}
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="eBay手数料率" name="ebayFeePctInput" defaultValue={defaults.ebayFeePctInput} step="0.01" suffix="%" hint="トレカは約13.25%" error={e.ebayFeePctInput} />
          <Field label="eBay定額手数料" name="ebayFixedFeeUsd" defaultValue={defaults.ebayFixedFeeUsd} step="0.01" suffix="USD" hint="1注文あたり（約$0.40）" error={e.ebayFixedFeeUsd} />
          <Field label="決済手数料率" name="paymentFeePctInput" defaultValue={defaults.paymentFeePctInput} step="0.1" suffix="%" hint="マネージドペイメントは0（eBay手数料に内包）" error={e.paymentFeePctInput} />
        </div>
        {defaults.paymentFeePctInput > 0 && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <b>決済手数料が {defaults.paymentFeePctInput}% になっています。</b>
            eBay のマネージドペイメントでは決済手数料は販売手数料に含まれるため、
            通常は <b>0</b> です。二重に引いていると利益が実際より少なく表示され、
            買えるカードを見送る方向に外れます。上のプリセットを押すと 0 になります。
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="為替/国際手数料率" name="fxFeePctInput" defaultValue={defaults.fxFeePctInput} step="0.1" suffix="%" hint="国際手数料の目安 約1.35%" error={e.fxFeePctInput} />
          <Field label="関税率（DDP）" name="tariffRatePctInput" defaultValue={defaults.tariffRatePctInput} step="0.1" suffix="%" hint="米国向け立替。日本原産は12.5。不要なら0" error={e.tariffRatePctInput} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="梱包費" name="packingJpy" defaultValue={defaults.packingJpy} suffix="円" error={e.packingJpy} />
          <Field label="その他手数料" name="otherFeeJpy" defaultValue={defaults.otherFeeJpy} suffix="円" error={e.otherFeeJpy} />
        </div>
        <p className="text-xs text-black/50 dark:text-white/50">
          ※ 手数料・関税は変わります。実際の請求に合わせて調整してください。決済手数料はeBay手数料に内包されるため二重計上に注意。
        </p>
      </fieldset>

      {/* --- 為替 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">為替</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FxRateInput
            name="defaultFxRate"
            defaultValue={String(defaults.defaultFxRate)}
            label="既定の為替レート（円/USD）"
            hint="カードごとに為替を指定しない場合に使う値。ボタンで現在レートを取得できます。"
            error={e.defaultFxRate}
          />
        </div>
      </fieldset>

      {/* --- まとめ発送 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">まとめ発送（同梱）</legend>
        <div className="-mt-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">1 のままにしておくのが安全です。</p>
          <p className="mt-1">
            同梱できるのは<b>同じ買い手が複数枚まとめて買ったとき</b>だけです。
            買い手が違えば宛先が違うので、1枚ずつ別便になります。
          </p>
          <p className="mt-1">
            ここを2以上にすると<b>全カードの送料が一律で安く計算され、利益が実際より多く見えます</b>。
            仕入れ判断に使うと、買うべきでないカードを買う方向に外れます。
            まとめ買いが常態化している場合にだけ変更してください。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="まとめて送る枚数" name="bundleCards" defaultValue={defaults.bundleCards} suffix="枚" hint="同じ買い手がまとめ買いする枚数。通常は1" error={e.bundleCards} />
        </div>
      </fieldset>

      {/* --- 仕入れ判定 --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">仕入れ判定のしきい値</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="仕入れ候補（以上）" name="thresholdBuyPct" defaultValue={defaults.thresholdBuyPct} step="0.1" suffix="%" hint="この利益率以上 → 仕入れ候補" error={e.thresholdBuyPct} />
          <Field label="検討（以上）" name="thresholdConsiderPct" defaultValue={defaults.thresholdConsiderPct} step="0.1" suffix="%" hint="この利益率以上 → 検討（未満は見送り）" error={e.thresholdConsiderPct} />
          <Field label="最低利益額" name="minProfitJpy" defaultValue={defaults.minProfitJpy} suffix="円" hint="これを下回ると見送りに下げる" error={e.minProfitJpy} />
          <Field label="海外に出す最低差額" name="minExportGainJpy" defaultValue={defaults.minExportGainJpy} suffix="円" hint="国内買取よりこの額以上多く残るなら海外へ。発送の手間の値段" error={e.minExportGainJpy} />
        </div>
      </fieldset>

      {/* --- 通知（アラート） --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">通知（アラート）</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="通知する利益率（以上）" name="notifyProfitRatePct" defaultValue={defaults.notifyProfitRatePct} step="0.1" suffix="%" hint="この利益率以上のカードをダッシュボードで通知" error={e.notifyProfitRatePct} />
          <Field label="通知する価格変動（以上）" name="notifyPriceChangePct" defaultValue={defaults.notifyPriceChangePct} step="0.1" suffix="%" hint="販売価格の上昇・仕入価格の下落をこの変動率で通知" error={e.notifyPriceChangePct} />
        </div>
      </fieldset>

      {/* --- PSA鑑定コスト --- */}
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">PSA鑑定コスト</legend>

        {/* 料金プリセット（ワンクリック入力） */}
        <div className="rounded-md border border-black/10 bg-black/[0.02] p-3 dark:border-white/15 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-medium text-black/60 dark:text-white/60">料金プリセット（目安・要確認）</div>
          <div className="flex flex-wrap gap-2">
            {GRADING_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  applyGradingPreset(p);
                  setPresetNote(p.note);
                }}
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
              >
                {p.label}
              </button>
            ))}
          </div>
          {presetNote && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">{presetNote}</p>
          )}
          <p className="mt-1 text-[11px] text-black/40 dark:text-white/40">
            ※ 円建て（PSA Japan）は「既定の為替レート」で USD 換算して入力します。適用後の金額は必要に応じて調整してください。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="鑑定料 レギュラープラン（1枚）" name="gradingFeeRegularUsd" defaultValue={defaults.gradingFeeRegularUsd} step="0.01" suffix="USD" hint="通常の納期。実費に合わせて調整" error={e.gradingFeeRegularUsd} />
          <Field label="鑑定料 エクスプレス（1枚）" name="gradingFeeExpressUsd" defaultValue={defaults.gradingFeeExpressUsd} step="0.01" suffix="USD" hint="短納期・高額" error={e.gradingFeeExpressUsd} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="鑑定の往復送料" name="gradingShipJpy" defaultValue={defaults.gradingShipJpy} suffix="円" hint="日本↔PSA の送料（代行経由含む）" error={e.gradingShipJpy} />
          <Field label="代行手数料" name="gradingAgentJpy" defaultValue={defaults.gradingAgentJpy} suffix="円" hint="鑑定代行を使う場合" error={e.gradingAgentJpy} />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "保存中..." : "設定を保存"}
        </button>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ダッシュボードへ
        </Link>
      </div>
    </form>
  );
}
