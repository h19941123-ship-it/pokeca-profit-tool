#!/bin/zsh
# 公開デモと同じ状態（DEMO_MODE=1）でローカルに起動する。
# 手元の dev.db ではなく prisma/demo.db のコピーを /tmp に置いて使うので、
# 本番の在庫データには一切触れない。
#
#   ./scripts/dev-demo.sh          … 4400番で起動
#   ./scripts/dev-demo.sh 4500     … ポート指定
#
# デモDBを作り直したいとき:
#   node scripts/seed-demo.mjs && rm -rf "${TMPDIR:-/tmp}/pokeca-demo"

cd "$(dirname "$0")/.." || exit 1

PORT="${1:-4400}"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
if ! command -v npm >/dev/null 2>&1; then
  NODE_BIN=$(ls -d "$NVM_DIR"/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
fi

# Next.js 16 は同じフォルダで dev サーバーを1つしか動かせない。
# 本番用（デスクトップのランチャー）が動いたままだと英語のエラーで止まるので、
# 先に日本語で理由を出す。こちらからは勝手に止めない（作業中かもしれないため）。
PROJECT_DIR="$(pwd)"
for pid in ${(f)"$(pgrep -f 'next(-server)? dev' 2>/dev/null)"}; do
  pid_cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
  if [ "$pid_cwd" = "$PROJECT_DIR" ]; then
    echo "──────────────────────────────────────────────"
    echo " 通常版のツールが起動中のため、デモ版は開けません。"
    echo " （Next.js は同じフォルダでサーバーを1つしか動かせません）"
    echo
    echo " 対処: 通常版のウィンドウを閉じてから、もう一度実行してください。"
    echo "       PID $pid / 強制停止する場合は  kill $pid"
    echo "──────────────────────────────────────────────"
    exit 1
  fi
done

export DEMO_MODE=1
exec npm run dev -- --port "$PORT"
