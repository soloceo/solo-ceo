import React from "react";
import { useT } from "../../i18n/context";
import { ClientsView } from "./ClientList";

export default function ClientListPage() {
  const { t } = useT();

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{t("pipeline.clients" as any)}</h1>
        </div>
      </header>
      <ClientsView />
    </div>
  );
}
