import React from "react";
import { useT } from "../../i18n/context";
import { LeadsView } from "./LeadsBoard";

export default function LeadsPage() {
  const { t } = useT();

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:p-6 lg:p-8 relative">
      <h1 className="sr-only">{t("pipeline.leads")}</h1>
      <LeadsView />
    </div>
  );
}
