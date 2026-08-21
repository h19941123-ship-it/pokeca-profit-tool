-- 相場ウォッチ: 監視対象と、その定点観測の記録。

CREATE TABLE "Watch" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL DEFAULT 'EBAY_US',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchSample" (
    "id" SERIAL NOT NULL,
    "watchId" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medianUsd" DOUBLE PRECISION NOT NULL,
    "minUsd" DOUBLE PRECISION NOT NULL,
    "maxUsd" DOUBLE PRECISION NOT NULL,
    "listingCount" INTEGER NOT NULL,
    CONSTRAINT "WatchSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Watch_active_idx" ON "Watch"("active");
CREATE INDEX "WatchSample_watchId_observedAt_idx" ON "WatchSample"("watchId", "observedAt");

ALTER TABLE "WatchSample" ADD CONSTRAINT "WatchSample_watchId_fkey"
    FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
