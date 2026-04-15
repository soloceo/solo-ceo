import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { useT } from "../i18n/context";

export default function PWAUpdatePrompt() {
  const { t } = useT();
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, r) {
      if (r) {
        intervalRef.current = setInterval(() => r.update(), 12 * 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleUpdate = useCallback(() => {
    if (updating) return;
    setUpdating(true);

    // Ask the waiting service worker to skipWaiting + activate.
    // vite-plugin-pwa listens for `controllerchange` and reloads,
    // but that event doesn't fire reliably on all platforms (notably
    // iOS Safari in standalone PWA mode). Fallback: force-reload
    // after 2s if the SW flow hasn't triggered a navigation yet.
    updateServiceWorker(true);

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }, [updating, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[var(--layer-pwa)] animate-fade-in"
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
        <RefreshCw
          size={16}
          className={`shrink-0 ${updating ? "animate-spin" : ""}`}
        />
        <span className="text-[14px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {updating ? t("app.pwa.updating") : t("app.pwa.newVersion")}
        </span>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="text-[14px] px-3 py-1 rounded-[var(--radius-6)] shrink-0 transition-opacity"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-brand-text)",
            fontWeight: "var(--font-weight-semibold)",
            opacity: updating ? 0.6 : 1,
          } as React.CSSProperties}
        >
          {t("app.pwa.update")}
        </button>
      </div>
    </div>
  );
}
