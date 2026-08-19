// 「国内の店に売る」か「海外(eBay)に出す」かの比較。
//
// 比べるのは “仕入れ値を引く前の手取り” 同士。すでに手元にあるカードなら
// 仕入れ値は両方に共通で沈んだコストなので、どちらが得かの判断には効かない。
//
//   国内の手取り = 買取額（店が払う額。手数料は引かれない）
//   海外の手取り = 売上 − eBay手数料 − 決済 − 為替 − 送料 − 梱包 − 関税
//
// 海外は梱包・発送・追跡・トラブル対応の手間がかかる。差額がわずかなら
// 国内で売った方が実質得なので、しきい値（minExportGainJpy）を置く。

import type { ProfitInputs } from "@/lib/profit";
import { netBeforePurchaseJpy } from "@/lib/advice";

/** どちらで売るべきか。 */
export type Channel = "EXPORT" | "DOMESTIC" | "EITHER";

export const CHANNEL_LABELS: Record<Channel, string> = {
  EXPORT: "海外に出す",
  DOMESTIC: "国内で売る",
  EITHER: "どちらでも",
};

export interface ChannelComparison {
  /** 国内買取額（＝そのまま手取り）。 */
  domesticNetJpy: number;
  /** 海外に出した場合の手取り（仕入れを引く前）。 */
  exportNetJpy: number;
  /** 海外 − 国内。プラスなら海外が有利。 */
  gainJpy: number;
  channel: Channel;
  channelLabel: string;
  /** 買取額が未入力（0以下）なら比較できない。 */
  configured: boolean;
}

/** NaN / Infinity を 0 に。 */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * 国内買取と海外販売を比べる。
 * @param inputs        利益計算の入力（販売価格・手数料など）
 * @param domesticJpy   国内買取額（円）。0以下なら未調査
 * @param minGainJpy    海外に出す価値があると見なす最低差額（円）
 */
export function compareChannels(
  inputs: ProfitInputs,
  domesticJpy: number,
  minGainJpy: number,
): ChannelComparison {
  const domesticNetJpy = Math.round(safe(domesticJpy));
  const exportNetJpy = Math.round(netBeforePurchaseJpy(inputs));
  const gainJpy = exportNetJpy - domesticNetJpy;
  const threshold = Math.max(Math.round(safe(minGainJpy)), 0);

  const configured = domesticNetJpy > 0;

  let channel: Channel;
  if (!configured) {
    // 買取額が分からないので比較不能。海外前提の扱いにしておく。
    channel = "EXPORT";
  } else if (gainJpy > threshold) {
    channel = "EXPORT";
  } else if (gainJpy < 0) {
    channel = "DOMESTIC";
  } else {
    // 海外の方が高いが、手間に見合うほどの差ではない
    channel = "EITHER";
  }

  return {
    domesticNetJpy,
    exportNetJpy,
    gainJpy,
    channel,
    channelLabel: CHANNEL_LABELS[channel],
    configured,
  };
}
