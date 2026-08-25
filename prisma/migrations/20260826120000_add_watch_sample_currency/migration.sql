-- 観測値の通貨。US 以外のマーケットを監視すると GBP/EUR などで記録されるのに、
-- 画面は $ 固定で出していた。既存行はすべて既定の EBAY_US で取ったものとして USD 扱い。
ALTER TABLE "WatchSample" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
