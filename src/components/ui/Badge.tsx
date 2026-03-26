import React from "react";
import { cn } from "../../lib/cn";

const variants = {
  default: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]",
  success: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-light)] text-[var(--color-danger)]",
  accent: "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
  blue: "bg-[rgba(78,167,252,0.1)] text-[var(--color-blue)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-1.5 py-px rounded-[var(--radius-4)]",
        variants[variant],
        className,
      )}
      style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
      {...props}
    >
      {children}
    </span>
  );
}
