// デモ表示のフラグ。
//
// DEMO_MODE=1 のとき、画面上部に「デモ版です」の帯を出す。
//
// 経緯: 以前は SQLite のファイルを /tmp にコピーする方式でデモを動かして
// いたが、常時アクセスのため PostgreSQL へ移行した際にその仕組みは不要に
// なった。デモを復活させる場合は、デモ用に別のデータベースを用意して
// DATABASE_URL を差し替え、scripts/seed-demo.mjs でサンプルを流し込む。

/** 公開デモとして動かしているか。 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}
