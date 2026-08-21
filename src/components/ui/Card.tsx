import type { ReactNode } from "react";

/** Raised surface container. Use className="p-0" for cards holding divided list rows. */
export default function Card({
  className = "p-4",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface shadow-xs ${className}`}>
      {children}
    </div>
  );
}
