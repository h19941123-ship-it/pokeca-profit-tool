// PWA マニフェスト。スマホのホーム画面に追加したときの見た目を定義。
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ポケカ 海外販売 利益判定ツール",
    short_name: "ポケカ利益判定",
    description: "仕入れ前に海外販売の予想利益と仕入れおすすめ度を判定するツール",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
