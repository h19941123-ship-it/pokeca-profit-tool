import { describe, it, expect } from "vitest";
import { buildAlerts, type AlertInput } from "./alerts";
import type { Settings, PriceHistory, Card } from "@/generated/prisma/client";
import type { ProfitResult } from "./profit";

const settings = {
  notifyProfitRatePct: 30,
  notifyPriceChangePct: 10,
} as Settings;

function card(id: number, name: string): Card {
  return { id, name } as Card;
}
function profit(rate: number | null, profitJpy = 1000): ProfitResult {
  return {
    revenueJpy: 0,
    fees: { ebayJpy: 0, paymentJpy: 0, fxJpy: 0, tariffJpy: 0, shippingJpy: 0, packingJpy: 0, otherJpy: 0 },
    totalCostJpy: 0,
    profitJpy,
    profitRate: rate,
    decision: "BUY",
    decisionLabel: "仕入れ候補",
    score: 100,
  };
}
function hist(sell: number, buy: number): PriceHistory {
  return { sellPriceUsd: sell, purchasePriceJpy: buy } as PriceHistory;
}

describe("buildAlerts", () => {
  it("利益率がしきい値以上 → high_rate", () => {
    const inputs: AlertInput[] = [{ card: card(1, "A"), profit: profit(35), history: [] }];
    const alerts = buildAlerts(inputs, settings);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("high_rate");
  });

  it("利益率がしきい値未満 → 通知なし", () => {
    const inputs: AlertInput[] = [{ card: card(1, "A"), profit: profit(20), history: [] }];
    expect(buildAlerts(inputs, settings)).toHaveLength(0);
  });

  it("販売価格が10%以上上昇 → sell_up（履歴は新しい順）", () => {
    const inputs: AlertInput[] = [
      { card: card(1, "A"), profit: profit(10), history: [hist(90, 5000), hist(80, 5000)] },
    ];
    const alerts = buildAlerts(inputs, settings);
    expect(alerts.map((a) => a.type)).toContain("sell_up");
  });

  it("仕入価格が10%以上下落 → buy_down", () => {
    const inputs: AlertInput[] = [
      { card: card(1, "A"), profit: profit(10), history: [hist(80, 4000), hist(80, 5000)] },
    ];
    const alerts = buildAlerts(inputs, settings);
    expect(alerts.map((a) => a.type)).toContain("buy_down");
  });

  it("変動が小さい → 価格アラートなし", () => {
    const inputs: AlertInput[] = [
      { card: card(1, "A"), profit: profit(10), history: [hist(82, 4900), hist(80, 5000)] },
    ];
    expect(buildAlerts(inputs, settings)).toHaveLength(0);
  });
});

describe("売却済カードは通知しない", () => {
  const row = (status: string): AlertInput => ({
    card: { ...card(1, "リザードンex SAR"), status } as Card,
    profit: profit(50),
    history: [],
  });

  it("手元に無いカードは高利益率でも通知に出さない", () => {
    expect(buildAlerts([row("STOCK")], settings).length).toBeGreaterThan(0);
    expect(buildAlerts([row("SOLD")], settings)).toEqual([]);
  });

  it("出品中はまだ値下げなどの手を打てるので通知する", () => {
    expect(buildAlerts([row("LISTED")], settings).length).toBeGreaterThan(0);
  });
});
