import React from "react";
import { cn } from "../../lib/cn";

const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[13px]",
  lg: "h-10 w-10 text-[15px]",
};

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-center overflow-hidden rounded-full",
        sizes[size],
        className,
      )}
      style={{
        background: src ? "transparent" : "var(--color-accent)",
        color: src ? undefined : "var(--color-brand-text)",
        fontWeight: src ? undefined : "var(--font-weight-bold)",
      }}
    >
      {src ? (
        <img src={src} alt={name || ""} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
