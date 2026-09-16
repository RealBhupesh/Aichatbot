"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "pill";

const variants: Record<Variant, string> = {
  primary:
    "h-12 rounded-lg bg-[var(--color-primary)] px-6 text-white hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)] disabled:text-white",
  secondary:
    "h-12 rounded-lg ring-1 ring-[var(--color-ink)] bg-transparent px-6 text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] disabled:cursor-not-allowed disabled:text-[var(--color-muted-soft)]",
  tertiary:
    "h-10 rounded-lg px-2 text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]",
  pill: "h-10 rounded-full bg-white px-4 text-sm text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] hover:ring-[var(--color-ink)]",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center text-[16px] font-medium transition-transform duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)] active:scale-[0.98] ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
