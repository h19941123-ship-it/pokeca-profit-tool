// 公開デモ用のデータベースを作り直すスクリプト。
//
//   node scripts/seed-demo.mjs
//
// prisma/demo.db を作り直して、実在のカード名・画像でサンプル在庫を入れる。
// 手元の dev.db（本番の在庫データ）には一切触らない。
//
// デモの狙い:
//   - 仕入れ候補 / 検討 / 見送り の3判定が全部出る
//   - 鑑定推奨バッジ・アラート・タグ・メモ・仕入先ランキングが埋まる
//   - 売却済のカードがあり、レポートの実現損益が0件にならない
//   - 価格履歴があり、詳細ページの推移グラフが描ける

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(projectRoot, "prisma", "demo.db");

// 画像URLは TCGdex の公開CDN。読み込みに失敗しても CardThumb が
// プレースホルダに切り替わるので、デモが壊れて見えることはない。
const img = (set, number) => `https://assets.tcgdex.net/ja/SV/${set}/${number}/high.webp`;

/** 何日か前の日時（履歴とアラートを自然に見せるため相対で作る）。 */
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

const CARDS = [
  {
    name: "リザードンex",
    cardNumber: "201/165",
    setName: "ポケモンカード151",
    rarity: "SAR",
    imageUrl: img("SV2a", "201"),
    purchasePriceJpy: 38000,
    supplier: "カードラッシュ",
    purchasedAt: daysAgo(24),
    stock: 1,
    sellPriceUsd: 420,
    shippingJpy: 1600,
    weightGrams: 100,
    // 鑑定シナリオ: PSA10 が付けば大きく伸びる想定 → 鑑定推奨バッジが出る
    psa10SellUsd: 900,
    psa9SellUsd: 380,
    psa10Prob: 55,
    gradedShippingJpy: 2800,
    status: "LISTED",
    tags: "高額, 151, PSA狙い",
    notes: "美品。センタリング良好でPSA10が狙える。",
    // 販売価格の上昇をアラートに出すための履歴
    history: [
      { at: daysAgo(21), sellPriceUsd: 360, fxRate: 148 },
      { at: daysAgo(14), sellPriceUsd: 385, fxRate: 151 },
      { at: daysAgo(7), sellPriceUsd: 398, fxRate: 149 },
      { at: daysAgo(2), sellPriceUsd: 420, fxRate: 150 },
    ],
  },
  {
    name: "ミュウex",
    cardNumber: "205/165",
    setName: "ポケモンカード151",
    rarity: "UR",
    imageUrl: img("SV2a", "205"),
    purchasePriceJpy: 9800,
    supplier: "駿河屋",
    purchasedAt: daysAgo(18),
    stock: 2,
    sellPriceUsd: 118,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "STOCK",
    tags: "151, 即売り",
    history: [
      { at: daysAgo(15), sellPriceUsd: 104, fxRate: 149 },
      { at: daysAgo(6), sellPriceUsd: 118, fxRate: 150 },
    ],
  },
  {
    name: "ボタン",
    cardNumber: "354/190",
    setName: "シャイニートレジャーex",
    rarity: "SAR",
    imageUrl: img("SV4a", "354"),
    purchasePriceJpy: 15500,
    supplier: "カードラッシュ",
    purchasedAt: daysAgo(12),
    stock: 1,
    sellPriceUsd: 178,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "LISTED",
    tags: "高額, サポート",
    notes: "海外人気が高い。値動きが早いので早めに出す。",
  },
  {
    name: "ピカチュウex",
    cardNumber: "236/187",
    setName: "テラスタルフェスex",
    rarity: "SAR",
    imageUrl: img("SV8a", "236"),
    purchasePriceJpy: 26000,
    supplier: "晴れる屋2",
    purchasedAt: daysAgo(9),
    stock: 1,
    sellPriceUsd: 270,
    shippingJpy: 1600,
    weightGrams: 100,
    status: "STOCK",
    tags: "高額",
    notes: "相場が落ち着くまで様子見。",
  },
  {
    name: "リザードンex",
    cardNumber: "349/190",
    setName: "シャイニートレジャーex",
    rarity: "SAR",
    imageUrl: img("SV4a", "349"),
    purchasePriceJpy: 52000,
    supplier: "メルカリ",
    purchasedAt: daysAgo(30),
    stock: 1,
    sellPriceUsd: 545,
    shippingJpy: 1600,
    weightGrams: 100,
    psa10SellUsd: 1100,
    psa9SellUsd: 470,
    psa10Prob: 45,
    gradedShippingJpy: 2800,
    status: "LISTED",
    tags: "高額, PSA狙い",
    history: [
      { at: daysAgo(28), sellPriceUsd: 520, fxRate: 152 },
      { at: daysAgo(10), sellPriceUsd: 545, fxRate: 150 },
    ],
  },
  {
    name: "ミモザ",
    cardNumber: "100/078",
    setName: "バイオレットex",
    rarity: "SR",
    imageUrl: img("SV1V", "100"),
    purchasePriceJpy: 6800,
    supplier: "駿河屋",
    purchasedAt: daysAgo(16),
    stock: 1,
    sellPriceUsd: 88,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "STOCK",
    tags: "サポート",
  },
  {
    name: "ゲッコウガex",
    cardNumber: "090/066",
    setName: "クリムゾンヘイズ",
    rarity: "SAR",
    imageUrl: img("SV5a", "090"),
    purchasePriceJpy: 8900,
    supplier: "メルカリ",
    purchasedAt: daysAgo(20),
    stock: 1,
    // 仕入れが高すぎて赤字 → 見送り判定のサンプル
    sellPriceUsd: 72,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "STOCK",
    notes: "仕入れ値が高すぎた。相場が戻るまで塩漬け。",
  },
  {
    name: "ミュウex",
    cardNumber: "347/190",
    setName: "シャイニートレジャーex",
    rarity: "SAR",
    imageUrl: img("SV4a", "347"),
    purchasePriceJpy: 11000,
    supplier: "駿河屋",
    purchasedAt: daysAgo(11),
    stock: 1,
    sellPriceUsd: 105,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "STOCK",
    tags: "要検討",
  },
  {
    name: "ボタン",
    cardNumber: "182/190",
    setName: "シャイニートレジャーex",
    rarity: "SR",
    imageUrl: img("SV4a", "182"),
    purchasePriceJpy: 4200,
    supplier: "カードラッシュ",
    purchasedAt: daysAgo(40),
    stock: 1,
    sellPriceUsd: 62,
    shippingJpy: 1200,
    weightGrams: 100,
    // 売却済 → レポートの実現損益に載る
    status: "SOLD",
    soldPriceUsd: 64,
    soldAt: daysAgo(6),
    tags: "即売り",
  },
  {
    name: "リザードンex",
    cardNumber: "125/108",
    setName: "黒煙の支配者",
    rarity: "SR",
    imageUrl: img("SV3", "125"),
    purchasePriceJpy: 3200,
    supplier: "晴れる屋2",
    purchasedAt: daysAgo(52),
    stock: 1,
    sellPriceUsd: 52,
    shippingJpy: 1200,
    weightGrams: 100,
    status: "SOLD",
    soldPriceUsd: 55,
    soldAt: daysAgo(33),
    tags: "即売り",
  },
];

// --- ここから下は組み立て処理 -------------------------------------------------

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

function rebuildSchema() {
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-journal`, { force: true });
  mkdirSync(path.dirname(dbPath), { recursive: true });
  // 既存のマイグレーションをそのまま適用する（スキーマを二重管理しない）
  execFileSync("npx", ["--yes", "prisma", "migrate", "deploy"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "inherit",
  });
}

/** 利益・利益率（履歴行に入れる値）。src/lib/profit.ts と同じ式。 */
function calcProfit({ purchasePriceJpy, sellPriceUsd, fxRate, shippingJpy }) {
  const revenue = Math.round(sellPriceUsd * fxRate);
  const ebay = Math.round(revenue * 0.13) + Math.round(0.4 * fxRate);
  const payment = Math.round(revenue * 0.03);
  const fx = Math.round(revenue * 0.02);
  const profit = revenue - (ebay + payment + fx + shippingJpy + 200) - purchasePriceJpy;
  return {
    profitJpy: profit,
    profitRate: Math.round((profit / purchasePriceJpy) * 10000) / 100,
  };
}

function seed() {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const insertCard = db.prepare(`
    INSERT INTO Card (
      name, cardNumber, setName, rarity, language, condition, imageUrl,
      purchasePriceJpy, supplier, purchasedAt, stock,
      sellPriceUsd, shippingChargedUsd, fxRate, shippingJpy, gradedShippingJpy, weightGrams,
      psa10SellUsd, psa9SellUsd, psa10Prob, gradingPlan,
      status, soldPriceUsd, soldAt, notes, tags,
      createdAt, updatedAt
    ) VALUES (
      @name, @cardNumber, @setName, @rarity, 'JP', @condition, @imageUrl,
      @purchasePriceJpy, @supplier, @purchasedAt, @stock,
      @sellPriceUsd, 0, NULL, @shippingJpy, @gradedShippingJpy, @weightGrams,
      @psa10SellUsd, @psa9SellUsd, @psa10Prob, 'REGULAR',
      @status, @soldPriceUsd, @soldAt, @notes, @tags,
      @createdAt, @createdAt
    )
  `);

  const insertHistory = db.prepare(`
    INSERT INTO PriceHistory (cardId, recordedAt, purchasePriceJpy, sellPriceUsd, fxRate, profitJpy, profitRate)
    VALUES (@cardId, @recordedAt, @purchasePriceJpy, @sellPriceUsd, @fxRate, @profitJpy, @profitRate)
  `);

  db.transaction(() => {
    db.prepare("DELETE FROM PriceHistory").run();
    db.prepare("DELETE FROM Card").run();
    db.prepare("DELETE FROM Settings").run();

    // 設定は既定値のまま（スキーマの @default が入る）
    db.prepare("INSERT INTO Settings (id, updatedAt) VALUES (1, ?)").run(iso(new Date()));

    for (const card of CARDS) {
      const row = {
        condition: "NM",
        supplier: null,
        purchasedAt: null,
        stock: 1,
        gradedShippingJpy: 0,
        weightGrams: null,
        psa10SellUsd: 0,
        psa9SellUsd: 0,
        psa10Prob: 0,
        soldPriceUsd: 0,
        soldAt: null,
        notes: null,
        tags: null,
        ...card,
        purchasedAt: iso(card.purchasedAt) ?? null,
        soldAt: iso(card.soldAt) ?? null,
        createdAt: iso(card.purchasedAt ?? new Date()),
      };
      delete row.history;
      const { lastInsertRowid: cardId } = insertCard.run(row);

      for (const point of card.history ?? []) {
        const { profitJpy, profitRate } = calcProfit({
          purchasePriceJpy: card.purchasePriceJpy,
          sellPriceUsd: point.sellPriceUsd,
          fxRate: point.fxRate,
          shippingJpy: card.shippingJpy,
        });
        insertHistory.run({
          cardId,
          recordedAt: iso(point.at),
          purchasePriceJpy: card.purchasePriceJpy,
          sellPriceUsd: point.sellPriceUsd,
          fxRate: point.fxRate,
          profitJpy,
          profitRate,
        });
      }
    }
  })();

  const cards = db.prepare("SELECT COUNT(*) n FROM Card").get().n;
  const history = db.prepare("SELECT COUNT(*) n FROM PriceHistory").get().n;
  db.close();
  console.log(`\nデモDBを作成しました: ${path.relative(projectRoot, dbPath)}`);
  console.log(`  カード ${cards} 件 / 価格履歴 ${history} 件`);
}

if (!existsSync(path.join(projectRoot, "prisma", "migrations"))) {
  console.error("prisma/migrations が見つかりません。プロジェクトルートから実行してください。");
  process.exit(1);
}

rebuildSchema();
seed();
