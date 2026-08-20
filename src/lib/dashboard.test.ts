import { describe, it, expect } from "vitest";
import { summarizeRows, type CardRow } from "./dashboard";
import type { ProfitResult } from "./profit";

function fees() {
  return { ebayJpy: 0, paymentJpy: 0, fxJpy: 0, tariffJpy: 0, shippingJpy: 0, packingJpy: 0, otherJpy: 0 };
}
function row(stock: number, purchase: number, profitJpy: number, rate: number | null, decision: ProfitResult["decision"]): CardRow {
  return {
    card: { stock, purchasePriceJpy: purchase } as CardRow["card"],
    fxRate: 150,
    sellingFeeJpy: 0,
    grading: { configured: false } as CardRow["grading"],
    profit: {
      revenueJpy: 0, fees: fees(), totalCostJpy: 0, profitJpy, profitRate: rate,
      decision, decisionLabel: decision, score: 0,
    },
  };
}

describe("summarizeRows", () => {
  it("在庫を掛けた合計・判定別件数・平均利益率", () => {
    const rows = [
      row(2, 5000, 3000, 60, "BUY"),   // 仕入10000, 利益6000
      row(1, 4000, 1000, 25, "CONSIDER"), // 仕入4000, 利益1000
      row(3, 3000, -500, null, "SKIP"), // 仕入9000, 利益-1500
    ];
    const s = summarizeRows(rows);
    expect(s.totalStock).toBe(6);
    expect(s.totalCostJpy).toBe(23000); // 10000+4000+9000
    expect(s.totalExpectedProfitJpy).toBe(6000 + 1000 - 1500);
    expect(s.avgProfitRate).toBe(42.5); // (60+25)/2、null除外
    expect(s.buy).toBe(1);
    expect(s.consider).toBe(1);
    expect(s.skip).toBe(1);
  });

  it("空なら平均はnull", () => {
    expect(summarizeRows([]).avgProfitRate).toBeNull();
  });
});

describe("summarizeRows（売却済の扱い）", () => {
  // 既存の row() は status を持たないので、この節用に status 付きで作る。
  function statusRow(status: string, decision: ProfitResult["decision"] = "BUY"): CardRow {
    const r = row(1, 4000, 3000, 40, decision);
    return { ...r, card: { ...r.card, status } as CardRow["card"] };
  }

  it("売却済カードは在庫・仕入原価・予想利益に数えない", () => {
    const only = summarizeRows([statusRow("STOCK")]);
    const both = summarizeRows([statusRow("STOCK"), statusRow("SOLD")]);

    expect(both.totalStock).toBe(only.totalStock);
    expect(both.totalCostJpy).toBe(only.totalCostJpy);
    expect(both.totalExpectedProfitJpy).toBe(only.totalExpectedProfitJpy);
  });

  it("除外した件数は soldCount で分かる（黙って消さない）", () => {
    expect(summarizeRows([statusRow("SOLD"), statusRow("STOCK")]).soldCount).toBe(1);
  });

  it("売却済は判定の件数にも入れない（手元に無いものを候補と呼ばない）", () => {
    const s = summarizeRows([statusRow("SOLD")]);
    expect(s.buy + s.consider + s.skip + s.unset).toBe(0);
  });

  it("出品中は手元にあるので集計に残す", () => {
    expect(summarizeRows([statusRow("LISTED")]).totalStock).toBe(1);
  });
});
