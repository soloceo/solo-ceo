import React from "react";
import { cn } from "../../lib/cn";

const variants = {
  flat: "card",
  elevated: "card-elevated",
  interactive: "card-interactive",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "flat", padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variants[variant], paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";
