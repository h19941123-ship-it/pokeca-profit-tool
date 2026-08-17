"use client";

// 削除ボタン。誤操作を防ぐため確認ダイアログを挟んでから Server Action を呼ぶ。

import { deleteCard } from "@/app/cards/actions";

export function DeleteButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteCard}
      onSubmit={(e) => {
        if (!window.confirm(`「${name}」を削除します。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-red-600 hover:underline"
        aria-label={`${name} を削除`}
      >
        削除
      </button>
    </form>
  );
}
