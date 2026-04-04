import React from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export const SyncIndicator = React.memo(function SyncIndicator({
  isOnline,
  syncStatus,
  pendingOps,
  compact = false,
}: {
  isOnline: boolean;
  syncStatus: "idle" | "syncing";
  pendingOps: number;
  compact?: boolean;
}) {
  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-1">
        <RefreshCw
          size={compact ? 18 : 14}
          className="animate-spin"
          style={{ color: "var(--color-accent)" }}
        />
        {!compact && pendingOps > 0 && (
          <span
            className="text-[13px]"
            style={{
              fontWeight: "var(--font-weight-medium)",
              color: "var(--color-accent)",
            } as React.CSSProperties}
          >
            {pendingOps}
          </span>
        )}
      </div>
    );
  }
  if (!isOnline)
    return (
      <CloudOff
        size={compact ? 18 : 14}
        style={{ color: "var(--color-warning)" }}
      />
    );
  return (
    <Cloud
      size={compact ? 18 : 14}
      style={{ color: "var(--color-green)" }}
    />
  );
});
