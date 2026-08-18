// 非制御フォームの input / select に、外部から値を差し込むためのヘルパー。
//
// なぜ専用の関数が要るのか:
//   React は input に独自の value セッターを噛ませて「前回の値」を覚えている
//   （value tracker）。素の `el.value = x` はこのトラッカーも一緒に更新して
//   しまうため、直後に input イベントを飛ばしても React 側は「値は変わって
//   いない」と判断してハンドラを呼ばない。
//
//   結果、「重量から計算」「eBayの最安を反映」「現在レート取得」などのボタンで
//   欄の数字は変わるのに、フォーム上部のライブ判定が古いままになる。
//
//   ネイティブのプロトタイプ側セッターを直接呼べばトラッカーを迂回できるので、
//   React が変更を検知してハンドラが走る。

/** input/select に値を入れて、React に変更を通知する。 */
export function setInputValue(
  el: HTMLInputElement | HTMLSelectElement | null,
  value: string | number,
): void {
  if (!el) return;
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, String(value));
  else el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** name 属性で探して値を入れる。 */
export function setInputValueByName(name: string, value: string | number): void {
  setInputValue(
    document.querySelector<HTMLInputElement>(`[name="${name}"]`),
    value,
  );
}
