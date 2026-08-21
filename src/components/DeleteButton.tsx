"use client";

import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/Button";

/** Submit button that asks for confirmation (via `confirm()`) before submitting its form. */
export default function DeleteButton({
  action,
  hiddenId,
  confirmMessage,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenId: number;
  confirmMessage: string;
  children: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={hiddenId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(confirmMessage)) e.preventDefault();
        }}
        className={buttonClassName("danger", "sm")}
      >
        {children}
      </button>
    </form>
  );
}
