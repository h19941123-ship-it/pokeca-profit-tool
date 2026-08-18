#!/bin/zsh
# eBay の App ID / Cert ID を .env に安全に書き込む。
#
#   ./scripts/set-ebay-keys.sh
#
# 画面にもコマンド履歴にも鍵は残らない（入力は非表示）。
# TextEdit で直接編集するとクォートの外に貼ってしまう事故が起きやすいため、
# こちらを使う。

cd "$(dirname "$0")/.." || exit 1
ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo ".env が見つかりません"; exit 1; }

echo "==============================================="
echo " eBay APIキーの設定"
echo " 入力は画面に表示されません。貼り付けてEnter。"
echo "==============================================="
echo

printf "App ID (Client ID): "
read -s APP_ID; echo
printf "Cert ID (Client Secret): "
read -s CERT_ID; echo
echo

# 前後の空白・改行を除去（コピペで紛れ込みやすい）
APP_ID="${APP_ID##[[:space:]]##}"; APP_ID="${APP_ID%%[[:space:]]##}"
CERT_ID="${CERT_ID##[[:space:]]##}"; CERT_ID="${CERT_ID%%[[:space:]]##}"

if [ -z "$APP_ID" ] || [ -z "$CERT_ID" ]; then
  echo "❌ 空の値が入力されました。中止します。"; exit 1
fi

# 形式チェック（値そのものは表示しない）
echo "入力の確認:"
echo "  App ID : ${#APP_ID} 文字"
echo "  Cert ID: ${#CERT_ID} 文字"
[[ "$CERT_ID" == PRD-* ]] && echo "  Cert ID: PRD- で始まっています（本番用）" \
  || echo "  ⚠️  Cert ID が PRD- で始まっていません。Production のものか確認してください。"
if [ ${#CERT_ID} -lt 40 ]; then
  echo "  ⚠️  Cert ID が短いようです。途中で切れていないか確認してください。"
fi
echo

python3 - "$APP_ID" "$CERT_ID" <<'PY'
import re, sys, pathlib
app_id, cert_id = sys.argv[1], sys.argv[2]
p = pathlib.Path(".env")
t = p.read_text(encoding="utf-8")
for key, val in (("EBAY_APP_ID", app_id), ("EBAY_CERT_ID", cert_id)):
    # 既存の行を丸ごと置き換える（クォート外への貼り付け事故も一緒に直る）
    t, n = re.subn(rf'^{key}=.*$', f'{key}="{val}"', t, count=1, flags=re.M)
    if n == 0:
        t = t.rstrip("\n") + f'\n{key}="{val}"\n'
print("✅ .env に書き込みました")
p.write_text(t, encoding="utf-8")
PY

echo
echo "次: デスクトップのアイコンでアプリを再起動してください。"
