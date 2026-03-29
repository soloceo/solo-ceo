import React from "react";
import { useT } from "../../i18n/context";
import { LeadsView } from "./LeadsBoard";

export default function LeadsPage() {
  const { t } = useT();

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <h1 className="sr-only">{t("pipeline.leads" as any)}</h1>
      <LeadsView />
    </div>
  );
}
