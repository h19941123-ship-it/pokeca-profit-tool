"use client";

// カード画像のサムネイル。imageUrl が無い/読み込み失敗のときはプレースホルダを表示する。
// 任意の外部URLを扱うため next/image ではなく素の img（lazy 読み込み）を使う。

import { useState } from "react";

export function CardThumb({
  url,
  alt,
  size = 40,
  rounded = "rounded",
}: {
  url: string | null | undefined;
  alt: string;
  size?: number;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const boxStyle = { width: size, height: size } as const;

  if (!url || failed) {
    const icon = Math.round(size * 0.5);
    return (
      <div
        style={boxStyle}
        className={`flex flex-shrink-0 items-center justify-center bg-black/[0.05] text-black/25 dark:bg-white/10 dark:text-white/25 ${rounded}`}
        role="img"
        aria-label={`${alt}（画像なし）`}
        title="画像なし"
      >
        {/* シンプルな画像プレースホルダ・アイコン */}
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.4" />
          <path d="M4.5 18l4.5-4.5 3 3 3-3 4.5 4.5" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={boxStyle}
      className={`flex-shrink-0 object-cover ${rounded}`}
    />
  );
}
