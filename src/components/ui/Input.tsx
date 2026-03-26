import React from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 px-3 text-[13px] rounded-[var(--radius-6)] outline-none transition-all",
            "bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)]",
            "placeholder:text-[var(--color-text-quaternary)]",
            "hover:border-[var(--color-border-secondary)]",
            "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-tint)]",
            error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[rgba(220,38,38,0.08)]",
            className,
          )}
          style={{ color: "var(--color-text-primary)" }}
          {...props}
        />
        {error && (
          <span className="text-[12px]" style={{ color: "var(--color-danger)" }}>{error}</span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "px-3 py-2 text-[13px] rounded-[var(--radius-6)] outline-none transition-all min-h-[80px] resize-y",
            "bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)]",
            "placeholder:text-[var(--color-text-quaternary)]",
            "hover:border-[var(--color-border-secondary)]",
            "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-tint)]",
            className,
          )}
          style={{ color: "var(--color-text-primary)" }}
          {...props}
        />
        {error && (
          <span className="text-[12px]" style={{ color: "var(--color-danger)" }}>{error}</span>
        )}
      </div>
    );
  },
);

TextArea.displayName = "TextArea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 px-3 pr-8 text-[13px] rounded-[var(--radius-6)] outline-none transition-all appearance-none",
            "bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)]",
            "hover:border-[var(--color-border-secondary)]",
            "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-tint)]",
            "bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%239ca3af%22%20stroke-width=%222%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat",
            className,
          )}
          style={{ color: "var(--color-text-primary)" }}
          {...props}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && (
          <span className="text-[12px]" style={{ color: "var(--color-danger)" }}>{error}</span>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
