import React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps["variant"];
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {icon && (
        <div className="mb-3" style={{ color: "var(--color-text-quaternary)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-[16px] mb-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
        {title}
      </h3>
      {description && (
        <p className="text-[15px] max-w-xs" style={{ color: "var(--color-text-tertiary)" }}>
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant || "secondary"}
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
