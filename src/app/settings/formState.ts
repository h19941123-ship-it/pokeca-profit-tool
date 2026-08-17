// 設定フォームの状態型と初期値（"use server" 制約のため action と分離）。

export type SettingsFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialSettingsFormState: SettingsFormState = {
  status: "idle",
  message: "",
};
