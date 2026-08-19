import { describe, it, expect } from "vitest";
import { compareChannels } from "@/lib/channel";
import type { ProfitInputs } from "@/lib/profit";

/** 売上6万円・諸経費が約1.3万円になる標準的な入力。 */
const base: ProfitInputs = {
  purchasePriceJpy: 30000,
  sellPriceUsd: 400,
  shippingChargedUsd: 0,
  fxRate: 150,
  shippingJpy: 1600,
  ebayFeePct: 0.13,
  ebayFixedFeeUsd: 0.4,
  paymentFeePct: 0.03,
  fxFeePct: 0.02,
  tariffRatePct: 0,
  packingJpy: 200,
  otherFeeJpy: 0,
  thresholdBuyPct: 30,
  thresholdConsiderPct: 20,
  minProfitJpy: 0,
};

describe("compareChannels", () => {
  it("仕入れ値は比較に影響しない（沈んだコストなので両者に共通）", () => {
    const a = compareChannels(base, 40000, 1000);
    const b = compareChannels({ ...base, purchasePriceJpy: 999999 }, 40000, 1000);
    expect(a.exportNetJpy).toBe(b.exportNetJpy);
    expect(a.gainJpy).toBe(b.gainJpy);
    expect(a.channel).toBe(b.channel);
  });

  it("海外の手取りは 売上 − 諸経費（仕入れは引かない）", () => {
    const r = compareChannels(base, 0, 1000);
    // 売上 400×150 = 60,000 から手数料・送料・梱包を引いた額
    expect(r.exportNetJpy).toBeGreaterThan(40000);
    expect(r.exportNetJpy).toBeLessThan(60000);
  });

  it("差が大きければ海外", () => {
    const r = compareChannels(base, 20000, 1000);
    expect(r.channel).toBe("EXPORT");
    expect(r.gainJpy).toBeGreaterThan(1000);
  });

  it("国内買取の方が高ければ国内", () => {
    const r = compareChannels(base, 90000, 1000);
    expect(r.channel).toBe("DOMESTIC");
    expect(r.gainJpy).toBeLessThan(0);
  });

  it("海外がわずかに高いだけなら「どちらでも」（手間に見合わない）", () => {
    const net = compareChannels(base, 0, 1000).exportNetJpy;
    const r = compareChannels(base, net - 500, 1000); // 差額500円
    expect(r.gainJpy).toBe(500);
    expect(r.channel).toBe("EITHER");
  });

  it("しきい値ちょうどは「どちらでも」（超えて初めて海外）", () => {
    const net = compareChannels(base, 0, 1000).exportNetJpy;
    expect(compareChannels(base, net - 1000, 1000).channel).toBe("EITHER");
    expect(compareChannels(base, net - 1001, 1000).channel).toBe("EXPORT");
  });

  it("しきい値0なら1円でも高い方を選ぶ", () => {
    const net = compareChannels(base, 0, 0).exportNetJpy;
    expect(compareChannels(base, net - 1, 0).channel).toBe("EXPORT");
    expect(compareChannels(base, net + 1, 0).channel).toBe("DOMESTIC");
  });

  it("買取額が未入力なら比較不能として扱う", () => {
    const r = compareChannels(base, 0, 1000);
    expect(r.configured).toBe(false);
    expect(r.channel).toBe("EXPORT");
  });

  it("負の買取額も未入力扱い", () => {
    expect(compareChannels(base, -500, 1000).configured).toBe(false);
  });

  it("不正な数値でも落ちない", () => {
    const r = compareChannels(base, NaN, NaN);
    expect(Number.isFinite(r.gainJpy)).toBe(true);
  });
});
