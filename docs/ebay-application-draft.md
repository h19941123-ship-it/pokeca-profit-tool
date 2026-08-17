# eBay Buy API（Browse API）本番アクセス申請 — 記入用ドラフト

申請フォームに**そのまま貼れる英文**と、各項目の答え方をまとめています。
申請の送信（ログイン・規約同意）はご本人の操作でお願いします。

> 提出先の目安：developer.ebay.com にログイン →
> 上部の「Application Access」/「Buy APIs」onboarding、または
> 対象キーセットの「Request production access」から。
> （画面の名称は変わることがあります。Browse API = "Buy" グループです）

---

## 申請フォームの項目 → 回答例

| 項目（英語で聞かれる） | 回答例 |
|---|---|
| Application type / Individual or Business | **Individual**（個人） |
| Which API(s) | **Browse API**（Buy） |
| eBay Partner Network member? | 加入していなければ **No**（求められたら加入を検討） |
| Marketplaces | **eBay US (EBAY_US)**（必要なら GB/DE/AU/CA も） |
| Estimated daily call volume | **Under 1,000 / day**（個人利用の少量） |
| Will you display eBay listings to the public? | **No — personal, internal use only** |
| Use case / Description | ↓ 下の英文をコピペ |

---

## そのまま貼れる英文（Description / Use case）

```
Application name: Poke Card Profit Checker (personal tool)

Purpose:
I am an individual reseller who buys Japanese Pokémon trading cards in Japan
and resells them on eBay. I have built a small personal tool that helps me
decide, before purchasing, whether a card can be resold profitably overseas.

How I will use the Browse API:
The tool takes a card name I enter and calls the Browse API
(item_summary/search) to retrieve the current ASKING prices of active
listings for that card. It then shows me a simple summary (lowest / median
price) so I can estimate a realistic resale price and calculate expected
profit after fees, shipping, and FX. All results are clearly labeled as
"estimates," not guaranteed prices.

Scope and volume:
- Personal, internal use only. Results are not published or resold.
- Low volume: well under 1,000 API calls per day (typically a few dozen).
- Marketplace: primarily EBAY_US.

Compliance:
- I will use only the official eBay APIs and will NOT scrape eBay web pages.
- I will follow the eBay API License Agreement and Buy API Terms of Use,
  including caching and data-use limits.
- I will not store or redistribute eBay listing data beyond what is needed
  for my own purchasing decisions.

Thank you for reviewing my request.
```

---

## 補足・コツ

- **正直に**：個人・非商用・少量・スクレイピングしない、を明確に。これがそのまま審査で有利に働きます。
- **英語で**：フォームは英語なので上の英文をそのまま貼ればOK。
- **EPN加入を求められたら**：<https://partnernetwork.ebay.com/> から無料で加入申請できます。
  （Buy API の一部はEPN加入が条件のことがあります）
- **却下されたら**：用途をさらに具体的に書いて再申請、または方針A（検索リンク）を継続。
- **通ったら**：Production の App ID / Cert ID を `.env` に貼って再起動（→ docs/ebay-api-setup.md ステップ4）。

---

## 提出前チェックリスト

- [ ] 開発者アカウント作成済み（ステップ1）
- [ ] Production キーセットを確認済み（ステップ2）
- [ ] 上の英文を申請フォームに貼った
- [ ] Individual / Browse API / EBAY_US を選択した
- [ ] 規約に同意して送信した
- [ ] 承認メールを待つ（数日〜。来たら .env に鍵を設定）
