-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "gradingFeeRegularUsd" REAL NOT NULL DEFAULT 79.99,
    "gradingFeeExpressUsd" REAL NOT NULL DEFAULT 149,
    "gradingShipJpy" INTEGER NOT NULL DEFAULT 2000,
    "gradingAgentJpy" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("defaultFxRate", "ebayFeePct", "fxFeePct", "gradingAgentJpy", "gradingFeeExpressUsd", "gradingFeeRegularUsd", "gradingFeeUsd", "gradingShipJpy", "id", "minProfitJpy", "notifyPriceChangePct", "notifyProfitRatePct", "otherFeeJpy", "packingJpy", "paymentFeePct", "thresholdBuyPct", "thresholdConsiderPct", "updatedAt") SELECT "defaultFxRate", "ebayFeePct", "fxFeePct", "gradingAgentJpy", "gradingFeeExpressUsd", "gradingFeeRegularUsd", "gradingFeeUsd", "gradingShipJpy", "id", "minProfitJpy", "notifyPriceChangePct", "notifyProfitRatePct", "otherFeeJpy", "packingJpy", "paymentFeePct", "thresholdBuyPct", "thresholdConsiderPct", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
