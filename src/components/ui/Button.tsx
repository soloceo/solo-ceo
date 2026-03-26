import React from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
  secondary: "bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-secondary)] hover:bg-[var(--color-bg-tertiary)]",
  ghost: "bg-transparent text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

const sizes = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-[var(--radius-4)]",
  md: "h-7 px-3 text-[13px] gap-1.5 rounded-[var(--radius-6)]",
  lg: "h-8 px-4 text-[13px] gap-2 rounded-[var(--radius-6)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-[var(--font-weight-medium)]",
          "transition-all duration-100",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
