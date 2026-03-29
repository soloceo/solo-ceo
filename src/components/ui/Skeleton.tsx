import React from "react";
import { cn } from "../../lib/cn";

export interface SkeletonProps {
  className?: string;
  key?: React.Key;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("skeleton-bone rounded-[var(--radius-12)]", className)} />
  );
}

/** Full-page loading skeleton for lazy-loaded pages */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-5 animate-skeleton-in" role="status" aria-label="Loading">
      <Skeleton className="h-[140px] rounded-[var(--radius-12)]" />
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-[80px] rounded-[var(--radius-12)]" />
        <Skeleton className="h-[80px] rounded-[var(--radius-12)]" />
      </div>
    </div>
  );
}
