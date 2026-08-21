import type { ComponentProps, ReactNode } from "react";

const CONTROL =
  "rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export const inputClassName = `h-9 ${CONTROL}`;

/** Styled text/date input. Extra classes (e.g. flex-1) can be appended via className. */
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${inputClassName} ${className}`} />;
}

/** Styled select. Pass options as children. */
export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${inputClassName} ${className}`} />;
}

/** Styled textarea. */
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`py-2 ${CONTROL} ${className}`} />;
}

/** Labeled form field: stacks a small label above its control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
