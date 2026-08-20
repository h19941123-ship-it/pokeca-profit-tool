-- eBay のマネージドペイメントでは決済手数料が販売手数料に内包されるため、
-- 既定値の3%は二重計上になる。新規DBの既定値のみ0に直す。
-- 既存の設定行の値は変更しない（利用者が意図して入れた値かもしれないため、
-- 画面側で警告して本人に判断してもらう）。
ALTER TABLE "Settings" ALTER COLUMN "paymentFeePct" SET DEFAULT 0;
