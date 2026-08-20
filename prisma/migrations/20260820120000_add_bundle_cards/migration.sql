-- まとめ発送（同梱）でまとめる枚数。1 = 従来どおり1枚ずつ発送するので既存の計算結果は変わらない。
ALTER TABLE "Settings" ADD COLUMN "bundleCards" INTEGER NOT NULL DEFAULT 1;
