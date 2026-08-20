-- 「売る前に見込んだ販売価格」。予想と実績のズレを測るために固定して残す。
ALTER TABLE "Card" ADD COLUMN "predictedSellUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 既存の出品中・売却済カードは、いま入っている販売価格を予想として引き継ぐ。
-- 売却額へ書き換え済みのカードでは差が0になるが、実際より悪い方へ歪めるより
-- 「ズレなし」として扱うほうが安全。件数が増えれば新規の記録が主になる。
UPDATE "Card"
SET "predictedSellUsd" = "sellPriceUsd"
WHERE "status" IN ('LISTED', 'SOLD') AND "sellPriceUsd" > 0;
