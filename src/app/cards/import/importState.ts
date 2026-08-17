// 一括インポートフォームの状態（useActionState 用）。

export interface ImportFormState {
  status: "idle" | "success" | "error";
  message?: string;
  importedCount?: number;
}

export const initialImportState: ImportFormState = { status: "idle" };
