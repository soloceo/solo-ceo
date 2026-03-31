import React, { useRef, useCallback } from "react";
import { useT } from "../../i18n/context";
import { LeadsView } from "./LeadsBoard";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";

export default function LeadsPage() {
  const { t } = useT();
  const pullRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("pull-refresh", { detail: { target: "leads" } }));
  }, []);
  usePullToRefresh(pullRef, refresh);

  return (
    <div ref={pullRef} className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:p-6 lg:p-8 relative">
      <h1 className="sr-only">{t("pipeline.leads")}</h1>
      <LeadsView />
    </div>
  );
}
