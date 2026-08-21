import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-border bg-surface hover:bg-surface-subtle",
  ghost: "text-muted hover:bg-surface-subtle hover:text-foreground",
  danger: "text-danger hover:bg-danger-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

/** Styled button. Defaults to the primary variant, medium size. */
export function Button({
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...props} className={buttonClassName(variant, size)} />;
}

/** Next.js link styled identically to Button, for navigation actions. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link {...props} className={buttonClassName(variant, size)} />;
}
