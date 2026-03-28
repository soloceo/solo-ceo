import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useSettingsStore } from "../store/useSettingsStore";

const getLabel = (zh: string, en: string) => {
  try {
    return localStorage.getItem("APP_LANGUAGE") === "en" ? en : zh;
  } catch {
    return zh;
  }
};

/**
 * Persistent offline banner shown when the app loses network connectivity.
 * Automatically hides when back online.
 */
export function OfflineBanner() {
  const isOnline = useSettingsStore((s) => s.isOnline);
  const syncStatus = useSettingsStore((s) => s.syncStatus);
  const pendingOps = useSettingsStore((s) => s.pendingOps);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when going offline again
  useEffect(() => {
    if (!isOnline) setDismissed(false);
  }, [isOnline]);

  // Don't show when online and idle
  if (isOnline && syncStatus === "idle") return null;
  // Don't show if user dismissed
  if (dismissed && isOnline) return null;

  const isSyncing = syncStatus === "syncing";

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs shrink-0"
      style={{
        background: isOnline
          ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
          : "color-mix(in srgb, var(--color-warning) 12%, transparent)",
        color: isOnline ? "var(--color-accent)" : "var(--color-warning)",
        borderBottom: "1px solid var(--color-line-tertiary)",
      }}
      role="status"
      aria-live="polite"
    >
      {!isOnline && <WifiOff size={12} />}
      {isSyncing && <RefreshCw size={12} className="animate-spin" />}
      <span>
        {!isOnline
          ? getLabel("当前离线 — 数据已保存在本地", "You're offline — data saved locally")
          : isSyncing
          ? getLabel(`正在同步${pendingOps > 0 ? ` (${pendingOps})` : ""}…`, `Syncing${pendingOps > 0 ? ` (${pendingOps})` : ""}…`)
          : pendingOps > 0
          ? getLabel(`${pendingOps} 条操作待同步`, `${pendingOps} operations pending sync`)
          : ""}
      </span>
      {!isOnline && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 underline hover:no-underline"
          style={{ color: "inherit" }}
        >
          {getLabel("知道了", "Dismiss")}
        </button>
      )}
    </div>
  );
}
