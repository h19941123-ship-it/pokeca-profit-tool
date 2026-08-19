-- CreateTable
CREATE TABLE "Card" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasePriceJpy" INTEGER NOT NULL,
    "sellPriceUsd" REAL NOT NULL,
    "fxRate" REAL NOT NULL,
    "profitJpy" INTEGER NOT NULL,
    "profitRate" REAL NOT NULL,
    CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_setName_idx" ON "Card"("setName");

-- CreateIndex
CREATE INDEX "PriceHistory_cardId_recordedAt_idx" ON "PriceHistory"("cardId", "recordedAt");
