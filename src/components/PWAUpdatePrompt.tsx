import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { useT } from "../i18n/context";

export default function PWAUpdatePrompt() {
  const { lang } = useT();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, r) {
      // Check for updates every 30 minutes
      if (r) setInterval(() => r.update(), 30 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[900] animate-fade-in"
      style={{ maxWidth: "calc(100vw - 32px)" }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-12)]"
        style={{
          background: "var(--color-text-primary)",
          color: "var(--color-bg-primary)",
          boxShadow: "var(--shadow-high)",
        }}
      >
        <RefreshCw size={16} className="shrink-0" />
        <span className="text-[14px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {lang === "zh" ? "发现新版本" : "New version available"}
        </span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-[14px] px-3 py-1 rounded-[var(--radius-6)] shrink-0"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-brand-text)",
            fontWeight: "var(--font-weight-semibold)",
          } as React.CSSProperties}
        >
          {lang === "zh" ? "立即更新" : "Update"}
        </button>
      </div>
    </div>
  );
}
