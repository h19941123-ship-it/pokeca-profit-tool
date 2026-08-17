// カード登録フォームの状態型と初期値。
// ※ Server Action ファイル("use server")は async 関数しか export できないため、
//   型や定数はこの通常モジュールに分離している。

/** フォームの状態（useActionState 用）。すべてシリアライズ可能。 */
export type CardFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  created?: {
    id: number;
    name: string;
    profitJpy: number;
    profitRate: number | null;
    decisionLabel: string;
    score: number;
  };
};

/** useActionState の初期状態。 */
export const initialCardFormState: CardFormState = {
  status: "idle",
  message: "",
};
