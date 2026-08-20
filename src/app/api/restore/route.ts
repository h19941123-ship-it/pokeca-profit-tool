// バックアップ(JSON)から復元する。POST /api/restore にバックアップJSONを送る。
// 既存カードは id 一致で上書き、無ければ新規作成。設定も上書き。

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
function date(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return Response.json({ ok: false, error: "不正なバックアップ形式です。" }, { status: 400 });
    }
    const cards: Record<string, unknown>[] = Array.isArray(body.cards) ? body.cards : [];
    const s = body.settings as Record<string, unknown> | undefined;

    // 設定の復元（既知の数値項目のみ）。行が無い新規DBでも失敗しないよう先に用意。
    if (s && typeof s === "object") {
      await getSettings(); // id=1 の行を保証（無ければ既定値で作成）
      await prisma.settings.update({
        where: { id: 1 },
        data: {
          ebayFeePct: num(s.ebayFeePct, 0.13),
          ebayFixedFeeUsd: num(s.ebayFixedFeeUsd, 0.4),
          paymentFeePct: num(s.paymentFeePct, 0.03),
          fxFeePct: num(s.fxFeePct, 0.02),
          tariffRatePct: num(s.tariffRatePct, 0),
          packingJpy: Math.round(num(s.packingJpy, 200)),
          otherFeeJpy: Math.round(num(s.otherFeeJpy, 0)),
          defaultFxRate: num(s.defaultFxRate, 150),
          thresholdBuyPct: num(s.thresholdBuyPct, 30),
          thresholdConsiderPct: num(s.thresholdConsiderPct, 20),
          minProfitJpy: Math.round(num(s.minProfitJpy, 0)),
          notifyProfitRatePct: num(s.notifyProfitRatePct, 30),
          notifyPriceChangePct: num(s.notifyPriceChangePct, 10),
          gradingFeeRegularUsd: num(s.gradingFeeRegularUsd, 79.99),
          gradingFeeExpressUsd: num(s.gradingFeeExpressUsd, 149),
          gradingShipJpy: Math.round(num(s.gradingShipJpy, 2000)),
          gradingAgentJpy: Math.round(num(s.gradingAgentJpy, 1000)),
        },
      });
    }

    // カードの復元（id 一致で upsert）
    let restored = 0;
    for (const c of cards) {
      const name = str(c.name);
      if (!name) continue;
      const data = {
        name,
        cardNumber: str(c.cardNumber),
        setName: str(c.setName),
        rarity: str(c.rarity),
        language: str(c.language) ?? "JP",
        condition: str(c.condition) ?? "NM",
        imageUrl: str(c.imageUrl),
        purchasePriceJpy: Math.round(num(c.purchasePriceJpy)),
        supplier: str(c.supplier),
        purchasedAt: date(c.purchasedAt),
        stock: Math.round(num(c.stock, 1)),
        sellPriceUsd: num(c.sellPriceUsd),
        shippingChargedUsd: num(c.shippingChargedUsd),
        fxRate: c.fxRate == null ? null : num(c.fxRate),
        shippingJpy: Math.round(num(c.shippingJpy)),
        gradedShippingJpy: Math.round(num(c.gradedShippingJpy)),
        weightGrams: c.weightGrams == null ? null : Math.round(num(c.weightGrams)),
        psa10SellUsd: num(c.psa10SellUsd),
        psa9SellUsd: num(c.psa9SellUsd),
        psa10Prob: num(c.psa10Prob),
        gradingPlan: str(c.gradingPlan) === "EXPRESS" ? "EXPRESS" : "REGULAR",
        // 以下はバックアップには入っているのに復元で捨てていた項目。
        // 売却済みの記録が落ちるとレポートの実現損益が丸ごと消えるため、
        // 取りこぼしがないよう Card の全列を明示的に扱う。
        domesticBuybackJpy: Math.round(num(c.domesticBuybackJpy)),
        status:
          str(c.status) === "LISTED" || str(c.status) === "SOLD"
            ? (str(c.status) as "LISTED" | "SOLD")
            : "STOCK",
        soldPriceUsd: num(c.soldPriceUsd),
        soldAt: date(c.soldAt),
        notes: str(c.notes),
        tags: str(c.tags),
      };
      const id = Number(c.id);
      if (Number.isInteger(id) && id > 0) {
        await prisma.card.upsert({ where: { id }, create: { id, ...data }, update: data });
      } else {
        await prisma.card.create({ data });
      }
      restored++;
    }

    return Response.json({ ok: true, restoredCards: restored }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("バックアップ復元に失敗", err);
    return Response.json({ ok: false, error: "復元に失敗しました。ファイル形式をご確認ください。" }, { status: 500 });
  }
}
