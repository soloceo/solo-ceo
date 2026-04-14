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
    <div ref={pullRef} className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:px-6 md:pb-6 md:pt-0 lg:px-8 lg:pb-8 lg:pt-0 relative">
      <h1 className="sr-only">{t("pipeline.clients")}</h1>
      <ClientsView />
    </div>
  );
}
