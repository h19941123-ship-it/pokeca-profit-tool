// アラート表示パネル（ダッシュボード上部）。
// buildAlerts の結果を種類別アイコン付きで一覧し、カード詳細へリンクする。

import Link from "next/link";
import { ALERT_META, type AlertItem } from "@/lib/alerts";

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-5 rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
      <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        🔔 アラート（{alerts.length}）
      </h2>
      <ul className="space-y-1.5">
        {alerts.map((a, i) => {
          const meta = ALERT_META[a.type];
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span aria-hidden>{meta.icon}</span>
              <Link href={`/cards/${a.cardId}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                {a.cardName}
              </Link>
              <span className="text-black/70 dark:text-white/70">{a.message}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
