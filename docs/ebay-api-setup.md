# eBay API 連携セットアップ手順（Browse API / 出品価格リサーチ）

このアプリで **eBay の出品中の価格をアプリ内に取り込む**（方針B）ための手順です。
今は方針A（検索欄からeBay公式検索を開くリンク）で動いています。有効なAPIキーが用意できたら、
`.env` に貼るだけで方針Bに切り替わります。

> ⚠️ この手順は 2026年時点の情報です。eBay側の画面や申請フローは変わることがあります。
> 実際の画面の案内を優先してください。

---

## これで何ができる／できないか

| API | 取れる情報 | 難易度 |
|---|---|---|
| **Browse API** | 出品中の価格（asking price）一覧 | 開発者登録＋**本番アクセス承認**が必要 |
| Marketplace Insights API | **売却済**の実売価格 | Limited Release・審査が非常に厳しい（個人ツールは通りにくい） |

このアプリの「eBay出品価格リサーチ」パネルは **Browse API** を使います。
売却済の実売価格は当面、方針A（検索欄の「売却済 ↗」リンク）で確認してください。

---

## 前提

- eBay の通常アカウント（買い物/出品用）が1つ必要です。無ければ先に作成してください。

---

## ステップ1：開発者アカウントを作る（無料・ただし審査待ちがある）

1. <https://developer.ebay.com/> を開く
2. 右上の **「Register」/「Join the developer program」** をクリック
3. eBayアカウントでサインイン → **API利用規約（License Agreement）に同意**
4. 確認メールが届くのでリンクを踏んで **メール認証**
5. **登録内容の審査を待つ（最低1営業日）** ← 即時ではない

> 📌 2026-08-18 実施時点の実際の挙動。
> メール認証が済むと "Your registration has been submitted for review.
> This usually takes at least one business day." と表示され、
> **この時点ではまだログインできません**。
> 承認されるとメールが届き、そこで初めてログイン → ステップ2に進めます。
> 画面を開いたまま待つ必要はありません。

---

## ステップ2：キーセット（App ID / Cert ID）を取得

1. ログイン後、上部メニュー **「My Account」→「Application Keysets」**（"Keys" と表記の場合あり）
2. **Sandbox** と **Production** の2種類のキーセットが表示されます
3. それぞれに次の3つがあります：
   - **App ID (Client ID)** ← このアプリの `EBAY_APP_ID`
   - Dev ID（このアプリでは未使用）
   - **Cert ID (Client Secret)** ← このアプリの `EBAY_CERT_ID`（「Show」を押すと表示）
4. まず動作テストだけしたいなら **Sandbox** でもOK。
   - ただし Sandbox は **架空のテストデータ**しか返りません（実際の相場は分かりません）。
   - 本番の実データが欲しいなら次のステップ3が必須です。

---

## ステップ3：Browse API（本番）の利用申請 ← 前回却下されたのはここ

本番の実データを検索するには、**「Buy APIs」の本番アクセス承認**が必要です。
（Browse API は eBay の "Buy" API グループに属します）

1. 開発者ポータルの **「Buy API」onboarding／申請フォーム**から申請します
   （"Application Growth Check" などの名称のことがあります）
2. 用途を記入します。例：
   - 「自分が仕入れたカードの海外販売価格をリサーチする個人用ツール」
   - 「非商用・自己利用」
3. **eBay Partner Network (EPN)** への加入を求められる場合があります
4. 承認されると、**Production の App ID / Cert ID** で Browse API が使えるようになります

### 承認を通しやすくするコツ
- 用途を具体的に書く（何のために・どんなデータを・どのくらいの頻度で）
- **eBayの利用規約を守る**旨を明記
- **スクレイピングはしない／公式APIのみ使う**旨を明記

> ⚠️ この承認は **eBay側の裁量**です。必ず通るとは限りません。
> 却下された場合は、このアプリは方針A（検索リンク）のまま問題なく使えます。

---

## ステップ4：このアプリに鍵を設定する

1. プロジェクトフォルダの **`.env`** をテキストエディタで開く
2. eBay の4行を次のように編集（`""` の中に貼る）：

   ```dotenv
   EBAY_APP_ID="（Production の App ID をここに）"
   EBAY_CERT_ID="（Production の Cert ID をここに）"
   EBAY_ENV="PRODUCTION"
   EBAY_MARKETPLACE_ID="EBAY_US"
   ```

   - `EBAY_ENV` は本番なら `PRODUCTION`、Sandboxで試すなら `SANDBOX`
   - `EBAY_MARKETPLACE_ID` は米国 `EBAY_US`、英国 `EBAY_GB`、ドイツ `EBAY_DE`、
     豪州 `EBAY_AU`、カナダ `EBAY_CA`
3. 保存する
4. **アプリを再起動**（デスクトップのアイコンのウィンドウを閉じて、もう一度ダブルクリック）

> 🔒 `.env` は Git に含まれません（`.gitignore` 済み）。鍵は他人に共有しないでください。

---

## ステップ5：動作確認

1. アプリでカードの **詳細ページ**を開く
2. 「**eBay出品価格リサーチ**」パネルで検索する
3. うまくいくと、出品中の価格一覧＋要約（最安・中央値など）が表示されます

---

## うまくいかない時（エラー別）

| 症状 | 原因と対処 |
|---|---|
| `invalid_client`（認証失敗） | App ID / Cert ID の貼り間違い。または本番未承認。`EBAY_ENV` が実際の鍵の種類と合っているか確認 |
| `403` / Insufficient permissions | Buy API の本番アクセスが未承認 → ステップ3 |
| 何も表示されない | 検索語やマーケット（国）を変えて試す。カード名は英語のほうが当たりやすい |
| キーを入れたのに反映されない | アプリの再起動を忘れていないか（`.env` は起動時に読み込まれます） |

---

## 参考リンク

- eBay 開発者ポータル: <https://developer.ebay.com/>
- Browse API ドキュメント: developer.ebay.com 内「Buy → Browse API」
- キーセット管理: My Account → Application Keysets

---

## 補足：売却済（実売）価格が欲しい場合

実売価格は **Marketplace Insights API** が必要ですが、これは Limited Release で審査が非常に厳しく、
個人ツールでは通りにくいのが実情です。当面は **方針A の検索欄「売却済 ↗」リンク**で
eBayの完了リストを確認するのが現実的です。
