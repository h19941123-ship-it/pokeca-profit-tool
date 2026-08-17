// 設定ページ。現在の設定を読み込み、フォームに初期表示する。
// 手数料は DB では小数（0.13）だが、画面では % 表示にするため変換する。

import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { SettingsForm, type SettingsDefaults } from "./SettingsForm";
import { BackupSection } from "@/components/BackupSection";

export const metadata = {
  title: "設定 | ポケカ利益判定ツール",
};

export default async function SettingsPage() {
  const s = await getSettings();

  const defaults: SettingsDefaults = {
    // 小数 → % に変換（丸め誤差を避けるため小数第2位まで）
    ebayFeePctInput: round2(s.ebayFeePct * 100),
    ebayFixedFeeUsd: s.ebayFixedFeeUsd,
    paymentFeePctInput: round2(s.paymentFeePct * 100),
    fxFeePctInput: round2(s.fxFeePct * 100),
    tariffRatePctInput: s.tariffRatePct,
    packingJpy: s.packingJpy,
    otherFeeJpy: s.otherFeeJpy,
    defaultFxRate: s.defaultFxRate,
    thresholdBuyPct: s.thresholdBuyPct,
    thresholdConsiderPct: s.thresholdConsiderPct,
    minProfitJpy: s.minProfitJpy,
    notifyProfitRatePct: s.notifyProfitRatePct,
    notifyPriceChangePct: s.notifyPriceChangePct,
    gradingFeeRegularUsd: s.gradingFeeRegularUsd,
    gradingFeeExpressUsd: s.gradingFeeExpressUsd,
    gradingShipJpy: s.gradingShipJpy,
    gradingAgentJpy: s.gradingAgentJpy,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">設定</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ダッシュボード
        </Link>
      </div>
      <SettingsForm defaults={defaults} />
      <div className="mt-8 border-t border-black/10 pt-6 dark:border-white/15">
        <BackupSection />
      </div>
    </main>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
