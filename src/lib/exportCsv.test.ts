// CSV の列数がヘッダーと一致することを確かめる。
// 列を1つ足し忘れると以降の値が全部隣の列にずれるが、CSV は開くまで気づけない。

import { describe, it, expect } from "vitest";
import { HEADERS, buildExportRow } from "./exportCsv";
import { buildRows } from "./dashboard";
import type { Card, Settings } from "@/generated/prisma/client";

const settings = {
  id: 1,
  ebayFeePct: 0.13, ebayFixedFeeUsd: 0.4, paymentFeePct: 0.03, fxFeePct: 0.02,
  tariffRatePct: 0, packingJpy: 200, otherFeeJpy: 0,
  defaultFxRate: 150, autoFxUpdate: false, lastFxUpdatedAt: null,
  thresholdBuyPct: 30, thresholdConsiderPct: 20, minProfitJpy: 0,
  minExportGainJpy: 1000, bundleCards: 1,
  notifyProfitRatePct: 30, notifyPriceChangePct: 10,
  gradingFeeRegularUsd: 79.99, gradingFeeExpressUsd: 149,
  gradingShipJpy: 2000, gradingAgentJpy: 1000,
  updatedAt: new Date(),
} as Settings;

function card(over: Partial<Card> = {}): Card {
  return {
    id: 1, name: "リザードンex SAR", cardNumber: "201/165", setName: "SV2a",
    rarity: "SAR", language: "JP", condition: "NM", imageUrl: null,
    purchasePriceJpy: 4000, supplier: "駿河屋", purchasedAt: new Date("2026-07-01"),
    stock: 1, sellPriceUsd: 62, shippingChargedUsd: 0, fxRate: null,
    shippingJpy: 1200, gradedShippingJpy: 0, weightGrams: 100,
    domesticBuybackJpy: 0, predictedSellUsd: 0,
    psa10SellUsd: 0, psa9SellUsd: 0, psa10Prob: 0, gradingPlan: "REGULAR",
    status: "STOCK", soldPriceUsd: 0, soldAt: null, notes: null, tags: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as Card;
}

const rowFor = (c: Card) => buildExportRow(buildRows([c], settings)[0], settings);

describe("CSV の列", () => {
  it("在庫カードの列数がヘッダーと一致する", () => {
    expect(rowFor(card())).toHaveLength(HEADERS.length);
  });

  it("売却済カードの列数がヘッダーと一致する", () => {
    const r = rowFor(card({ status: "SOLD", soldPriceUsd: 48, predictedSellUsd: 62, soldAt: new Date("2026-08-01") }));
    expect(r).toHaveLength(HEADERS.length);
  });

  it("売却済なら予想とのズレが入る", () => {
    const r = rowFor(card({ status: "SOLD", soldPriceUsd: 48, predictedSellUsd: 62 }));
    const i = HEADERS.indexOf("予想とのズレ(%)");
    expect(r[i]).toBeCloseTo(-22.6, 0); // 62 → 48 は約22.6%安い
  });

  it("未売却・予想未記録なら空欄（0を入れると「ズレ無し」に見えるため）", () => {
    const i = HEADERS.indexOf("予想とのズレ(%)");
    expect(rowFor(card())[i]).toBe("");
    expect(rowFor(card({ status: "SOLD", soldPriceUsd: 48 }))[i]).toBe("");
  });

  it("ヘッダーに重複した列名がない", () => {
    expect(new Set(HEADERS).size).toBe(HEADERS.length);
  });
});
