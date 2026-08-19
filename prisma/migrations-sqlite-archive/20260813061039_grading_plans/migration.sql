-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cardNumber" TEXT,
    "setName" TEXT,
    "rarity" TEXT,
    "language" TEXT NOT NULL DEFAULT 'JP',
    "condition" TEXT NOT NULL DEFAULT 'NM',
    "imageUrl" TEXT,
    "purchasePriceJpy" INTEGER NOT NULL,
    "supplier" TEXT,
    "purchasedAt" DATETIME,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "sellPriceUsd" REAL NOT NULL DEFAULT 0,
    "fxRate" REAL,
    "shippingJpy" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "psa10SellUsd" REAL NOT NULL DEFAULT 0,
    "psa9SellUsd" REAL NOT NULL DEFAULT 0,
    "psa10Prob" REAL NOT NULL DEFAULT 0,
    "gradingPlan" TEXT NOT NULL DEFAULT 'REGULAR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Card" ("cardNumber", "condition", "createdAt", "fxRate", "id", "imageUrl", "language", "name", "psa10Prob", "psa10SellUsd", "psa9SellUsd", "purchasePriceJpy", "purchasedAt", "rarity", "sellPriceUsd", "setName", "shippingJpy", "stock", "supplier", "updatedAt", "weightGrams") SELECT "cardNumber", "condition", "createdAt", "fxRate", "id", "imageUrl", "language", "name", "psa10Prob", "psa10SellUsd", "psa9SellUsd", "purchasePriceJpy", "purchasedAt", "rarity", "sellPriceUsd", "setName", "shippingJpy", "stock", "supplier", "updatedAt", "weightGrams" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_name_idx" ON "Card"("name");
CREATE INDEX "Card_setName_idx" ON "Card"("setName");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "ebayFeePct" REAL NOT NULL DEFAULT 0.13,
    "paymentFeePct" REAL NOT NULL DEFAULT 0.03,
    "fxFeePct" REAL NOT NULL DEFAULT 0.02,
    "packingJpy" INTEGER NOT NULL DEFAULT 200,
    "otherFeeJpy" INTEGER NOT NULL DEFAULT 0,
    "defaultFxRate" REAL NOT NULL DEFAULT 150,
    "thresholdBuyPct" REAL NOT NULL DEFAULT 30,
    "thresholdConsiderPct" REAL NOT NULL DEFAULT 20,
    "minProfitJpy" INTEGER NOT NULL DEFAULT 0,
    "notifyProfitRatePct" REAL NOT NULL DEFAULT 30,
    "notifyPriceChangePct" REAL NOT NULL DEFAULT 10,
    "gradingFeeUsd" REAL NOT NULL DEFAULT 25,
    "gradingFeeRegularUsd" REAL NOT NULL DEFAULT 25,
    "gradingFeeExpressUsd" REAL NOT NULL DEFAULT 75,
    "gradingShipJpy" INTEGER NOT NULL DEFAULT 2000,
    "gradingAgentJpy" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("defaultFxRate", "ebayFeePct", "fxFeePct", "gradingAgentJpy", "gradingFeeUsd", "gradingShipJpy", "id", "minProfitJpy", "notifyPriceChangePct", "notifyProfitRatePct", "otherFeeJpy", "packingJpy", "paymentFeePct", "thresholdBuyPct", "thresholdConsiderPct", "updatedAt") SELECT "defaultFxRate", "ebayFeePct", "fxFeePct", "gradingAgentJpy", "gradingFeeUsd", "gradingShipJpy", "id", "minProfitJpy", "notifyPriceChangePct", "notifyProfitRatePct", "otherFeeJpy", "packingJpy", "paymentFeePct", "thresholdBuyPct", "thresholdConsiderPct", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
