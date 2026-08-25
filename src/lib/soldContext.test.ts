import { describe, it, expect } from "vitest";
import { parseSoldContext, nextSoldContext, type SoldContext } from "@/lib/soldContext";
import { calcProfit } from "@/lib/profit";

const feeBase: SoldContext = {
  shippingChargedUsd: 0,
  fxRate: 150,
  shippingJpy: 1800,
  ebayFeePct: 0.13,
  ebayFixedFeeUsd: 0.4,
  paymentFeePct: 0,
  fxFeePct: 0.02,
  tariffRatePct: 0,
  packingJpy: 200,
  otherFeeJpy: 0,
  thresholdBuyPct: 30,
  thresholdConsiderPct: 20,
  minProfitJpy: 0,
};

describe("parseSoldContext", () => {
  it("全項目そろっていれば読み取る", () => {
    expect(parseSoldContext({ ...feeBase })).toEqual(feeBase);
  });

  it("項目が1つでも欠けたら null（部分的に今の設定で埋めない）", () => {
    // 固定された値と現在の値が混ざると、どちらの条件で出した数字か
    // 説明できなくなる。欠けているなら概算として扱うほうがまだ正直。
    const { fxRate: _omit, ...partial } = feeBase;
    void _omit;
    expect(parseSoldContext(partial)).toBeNull();
  });

  it("数値でない値が入っていたら null", () => {
    expect(parseSoldContext({ ...feeBase, fxRate: "150" })).toBeNull();
    expect(parseSoldContext({ ...feeBase, fxRate: NaN })).toBeNull();
  });

  it("null・配列・文字列は null", () => {
    expect(parseSoldContext(null)).toBeNull();
    expect(parseSoldContext([feeBase])).toBeNull();
    expect(parseSoldContext("{}")).toBeNull();
  });
});

describe("nextSoldContext", () => {
  it("売却済になった時点の条件を固定する", () => {
    const next = nextSoldContext({ current: null, nextStatus: "SOLD", feeBase });
    expect(next).toMatchObject({ fxRate: 150, ebayFeePct: 0.13 });
  });

  it("一度固定したら、あとで設定を変えても上書きしない", () => {
    const pinned = { ...feeBase, fxRate: 150 };
    const next = nextSoldContext({
      current: pinned,
      nextStatus: "SOLD",
      feeBase: { ...feeBase, fxRate: 999 }, // 現在の設定は変わっている
    });
    expect(next!.fxRate).toBe(150);
  });

  it("売却済以外なら固定しない（在庫・出品中に戻したら破棄）", () => {
    expect(nextSoldContext({ current: null, nextStatus: "STOCK", feeBase })).toBeNull();
    expect(nextSoldContext({ current: feeBase, nextStatus: "LISTED", feeBase })).toBeNull();
  });
});

describe("固定した条件で実現損益が動かないこと", () => {
  const purchasePriceJpy = 8000;
  const soldPriceUsd = 120;

  it("設定を変えても、固定済みなら金額は同じ", () => {
    const atSale = calcProfit({ ...feeBase, purchasePriceJpy, sellPriceUsd: soldPriceUsd });

    // 売却後に既定レートと手数料率を変えた、という状況
    const laterSettings: SoldContext = { ...feeBase, fxRate: 155, ebayFeePct: 0.15, packingJpy: 400 };
    const withSnapshot = calcProfit({
      ...parseSoldContext({ ...feeBase })!,
      purchasePriceJpy,
      sellPriceUsd: soldPriceUsd,
    });
    const withoutSnapshot = calcProfit({ ...laterSettings, purchasePriceJpy, sellPriceUsd: soldPriceUsd });

    expect(withSnapshot.profitJpy).toBe(atSale.profitJpy);
    // 固定しない場合はこれだけ動く（この差が過去の実績に出ていた）
    expect(withoutSnapshot.profitJpy).not.toBe(atSale.profitJpy);
  });
});
