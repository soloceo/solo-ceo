import React, { useRef, useCallback } from "react";
import { useT } from "../../i18n/context";
import { ClientsView } from "./ClientList";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";

export default function ClientListPage() {
  const { t } = useT();
  const pullRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    // Dispatch a custom event that ClientsView listens for to trigger refresh
    window.dispatchEvent(new CustomEvent("pull-refresh", { detail: { target: "clients" } }));
  }, []);
  usePullToRefresh(pullRef, refresh);

  return (
    <div ref={pullRef} className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:p-6 lg:p-8 relative">
      <h1 className="sr-only">{t("pipeline.clients")}</h1>
      <ClientsView />
    </div>
  );
}
