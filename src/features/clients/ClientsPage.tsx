import React, { useState, lazy, Suspense } from "react";
import { useT } from "../../i18n/context";
import { Briefcase } from "lucide-react";
import { LeadsView } from "./LeadsBoard";
import { ClientsView } from "./ClientList";

const SalesToolsPanel = lazy(() => import("../../components/SalesTools"));

type Segment = "leads" | "clients";

export default function ClientsPage() {
  const { t } = useT();
  const [segment, setSegment] = useState<Segment>("leads");
  const [salesToolsOpen, setSalesToolsOpen] = useState(false);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <header className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="page-title">{t("pipeline.pageTitle" as any)}</h1>
          <button
            onClick={() => setSalesToolsOpen(true)}
            className="btn-ghost flex items-center gap-1.5 text-[13px]"
            style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            <Briefcase size={16} />
            <span className="hidden sm:inline">{t("pipeline.salesTools" as any)}</span>
          </button>
        </div>
        <div className="segment-switcher">
          {(["leads", "clients"] as const).map((s) => (
            <button key={s} onClick={() => setSegment(s)} data-active={segment === s}>
              {s === "leads" ? t("pipeline.leads" as any) : t("pipeline.clients" as any)}
            </button>
          ))}
        </div>
      </header>
      {segment === "leads" ? <LeadsView /> : <ClientsView />}
      <Suspense fallback={null}>
        <SalesToolsPanel open={salesToolsOpen} onClose={() => setSalesToolsOpen(false)} />
      </Suspense>
    </div>
  );
}
