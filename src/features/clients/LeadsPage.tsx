import React, { useState, lazy, Suspense } from "react";
import { useT } from "../../i18n/context";
import { Briefcase } from "lucide-react";
import { LeadsView } from "./LeadsBoard";

const SalesToolsPanel = lazy(() => import("../../components/SalesTools"));

export default function LeadsPage() {
  const { t } = useT();
  const [salesToolsOpen, setSalesToolsOpen] = useState(false);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{t("pipeline.leads" as any)}</h1>
          <button
            onClick={() => setSalesToolsOpen(true)}
            className="btn-ghost compact flex items-center gap-1.5"
            style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            <Briefcase size={16} />
            <span>{t("pipeline.salesTools" as any)}</span>
          </button>
        </div>
      </header>
      <LeadsView />
      <Suspense fallback={null}>
        <SalesToolsPanel open={salesToolsOpen} onClose={() => setSalesToolsOpen(false)} />
      </Suspense>
    </div>
  );
}
