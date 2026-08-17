// 公開デモであることを知らせる帯。DEMO_MODE=1 のときだけ出る。
//
// 見に来た人に「本物の在庫ではない」「自由に触ってよい」を先に伝えるためのもの。
// これが無いと、勝手にデータを消していいのか判断できず結局何も触られない。

import { isDemoMode } from "@/lib/demoDb";

export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <span className="font-semibold">デモ版</span>
      ：サンプルデータです。登録・編集・削除を自由にお試しください（しばらくすると元に戻ります）。
    </div>
  );
}
