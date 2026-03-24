import React from "react";

/**
 * Skeleton loader — shimmer effect that matches content layout.
 * Use instead of spinners. Shows within 300ms via CSS animation-delay.
 */

function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton-bone rounded ${className}`}
      style={{ background: "var(--surface-alt)", ...style }}
    />
  );
}

/** Dashboard skeleton — matches Home hero + KPI + focus cards */
export function HomeSkeleton() {
  return (
    <div className="space-y-5 p-4 animate-skeleton-in">
      {/* Hero card */}
      <Bone className="h-[180px] rounded-2xl" />
      {/* Focus section label */}
      <Bone className="h-4 w-24" />
      {/* Focus cards */}
      <div className="space-y-3">
        <Bone className="h-[100px] rounded-xl" />
        <Bone className="h-[100px] rounded-xl" />
      </div>
      {/* Accordions */}
      <div className="space-y-2">
        <Bone className="h-12 rounded-xl" />
        <Bone className="h-12 rounded-xl" />
        <Bone className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

/** List skeleton — for Pipeline, Work, Finance lists */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4 animate-skeleton-in">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2" style={{ animationDelay: `${i * 50}ms` }}>
          <Bone className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-3/4" />
            <Bone className="h-2.5 w-1/2" />
          </div>
          <Bone className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Finance skeleton — stats + chart + list */
export function FinanceSkeleton() {
  return (
    <div className="space-y-5 p-4 animate-skeleton-in">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <Bone key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      {/* Chart */}
      <Bone className="h-[200px] rounded-xl" />
      {/* Recent list */}
      <ListSkeleton rows={5} />
    </div>
  );
}

/** Generic inline skeleton for single values */
export function InlineSkeleton({ width = 60 }: { width?: number }) {
  return <Bone className="h-4 inline-block rounded" style={{ width }} />;
}
