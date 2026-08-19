// 買取額の一括入力フォームの状態（useActionState 用）。

export interface BuybackFormState {
  status: "idle" | "success" | "error";
  message?: string;
  updatedCount?: number;
}

export const initialBuybackState: BuybackFormState = { status: "idle" };
