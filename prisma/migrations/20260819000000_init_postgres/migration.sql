-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cardNumber" TEXT,
    "setName" TEXT,
    "rarity" TEXT,
    "language" TEXT NOT NULL DEFAULT 'JP',
    "condition" TEXT NOT NULL DEFAULT 'NM',
    "imageUrl" TEXT,
    "purchasePriceJpy" INTEGER NOT NULL,
    "supplier" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "stock" INTEGER NOT NULL DEFAULT 1,
    "sellPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingChargedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fxRate" DOUBLE PRECISION,
    "shippingJpy" INTEGER NOT NULL DEFAULT 0,
    "gradedShippingJpy" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "psa10SellUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "psa9SellUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "psa10Prob" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gradingPlan" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'STOCK',
    "soldPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldAt" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ebayFeePct" DOUBLE PRECISION NOT NULL DEFAULT 0.13,
    "ebayFixedFeeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "paymentFeePct" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "fxFeePct" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "tariffRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packingJpy" INTEGER NOT NULL DEFAULT 200,
    "otherFeeJpy" INTEGER NOT NULL DEFAULT 0,
    "defaultFxRate" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "autoFxUpdate" BOOLEAN NOT NULL DEFAULT false,
    "lastFxUpdatedAt" TIMESTAMP(3),
    "thresholdBuyPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "thresholdConsiderPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "minProfitJpy" INTEGER NOT NULL DEFAULT 0,
    "notifyProfitRatePct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "notifyPriceChangePct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "gradingFeeRegularUsd" DOUBLE PRECISION NOT NULL DEFAULT 79.99,
    "gradingFeeExpressUsd" DOUBLE PRECISION NOT NULL DEFAULT 149,
    "gradingShipJpy" INTEGER NOT NULL DEFAULT 2000,
    "gradingAgentJpy" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasePriceJpy" INTEGER NOT NULL,
    "sellPriceUsd" DOUBLE PRECISION NOT NULL,
    "fxRate" DOUBLE PRECISION NOT NULL,
    "profitJpy" INTEGER NOT NULL,
    "profitRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_setName_idx" ON "Card"("setName");

-- CreateIndex
CREATE INDEX "PriceHistory_cardId_recordedAt_idx" ON "PriceHistory"("cardId", "recordedAt");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

