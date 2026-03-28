import React from "react";
import { useCountUp } from "../../hooks/useCountUp";
import { useT } from "../../i18n/context";

interface KPIGridProps {
  mrr: number;
  ytdRevenue: number;
  todayIncome: number;
  clientsCount: number;
  leadsCount: number;
  activeTasks: number;
  loading: boolean;
}

export function KPIGrid({ mrr, ytdRevenue, todayIncome, clientsCount, leadsCount, activeTasks, loading }: KPIGridProps) {
  const { t } = useT();
  const animMrr = useCountUp(mrr);
  const animYtd = useCountUp(ytdRevenue);

  const stats = [
    {
      label: "MRR",
      value: loading ? "—" : `$${animMrr.toLocaleString()}`,
      color: "var(--color-accent)",
    },
    {
      label: t("home.kpi.ytdRevenue" as any),
      value: loading ? "—" : `$${animYtd.toLocaleString()}`,
      color: "var(--color-success)",
      sub: todayIncome > 0 ? `+$${todayIncome.toLocaleString()}` : undefined,
    },
    {
      label: t("home.kpi.activeClients" as any),
      value: loading ? "—" : String(clientsCount),
      color: "var(--color-blue)",
      sub: leadsCount > 0 ? `+${leadsCount} ${t("home.kpi.leads" as any)}` : undefined,
    },
    {
      label: t("home.kpi.inProgress" as any),
      value: loading ? "—" : String(activeTasks),
      color: "var(--color-warning)",
    },
  ];

  return (
    <div
      className="card flex items-stretch divide-x divide-[var(--color-line-secondary)]"
    >
      {stats.map((s) => (
        <div key={s.label} className="flex-1 px-4 py-3 min-w-0">
          <div className="text-[13px] mb-0.5 truncate" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {s.label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[18px] tracking-tight tabular-nums select-all"
              style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
            >
              {s.value}
            </span>
            {s.sub && (
              <span className="text-[13px] truncate" style={{ color: s.color, fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {s.sub}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
