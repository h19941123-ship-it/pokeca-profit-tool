-- 国内買取額（海外に出すか国内で売るかの比較用）
ALTER TABLE "Card" ADD COLUMN "domesticBuybackJpy" INTEGER NOT NULL DEFAULT 0;

-- 海外に出す価値があると見なす最低差額
ALTER TABLE "Settings" ADD COLUMN "minExportGainJpy" INTEGER NOT NULL DEFAULT 1000;
