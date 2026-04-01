import React from "react";
import { useCountUp } from "../../hooks/useCountUp";
import { useT } from "../../i18n/context";

interface KPIGridProps {
  mrr: number;
  ytdRevenue: number;
  todayIncome: number;
  clientsCount: number;
  leadsCount: number;
  workTasks: number;
  personalTasks: number;
  loading: boolean;
}

export function KPIGrid({ mrr, ytdRevenue, todayIncome, clientsCount, leadsCount, workTasks, personalTasks, loading }: KPIGridProps) {
  const { t, lang } = useT();
  const animMrr = useCountUp(mrr);
  const animYtd = useCountUp(ytdRevenue);

  const stats = [
    {
      label: "MRR",
      value: loading ? "—" : `$${animMrr.toLocaleString()}`,
      color: "var(--color-accent)",
    },
    {
      label: t("home.kpi.ytdRevenue"),
      value: loading ? "—" : `$${animYtd.toLocaleString()}`,
      color: "var(--color-success)",
      sub: todayIncome > 0 ? `+$${todayIncome.toLocaleString()}` : undefined,
    },
    {
      label: t("home.kpi.activeClients"),
      value: loading ? "—" : String(clientsCount),
      color: "var(--color-blue)",
      sub: leadsCount > 0 ? `+${leadsCount} ${t("home.kpi.leads")}` : undefined,
    },
    {
      label: null,
      value: null,
      color: "var(--color-accent)",
      lines: [
        { label: t("home.kpi.workTasks"), count: workTasks, color: "var(--color-accent)" },
        { label: t("home.kpi.personalTasks"), count: personalTasks, color: "var(--color-info)" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {stats.map((s, idx) => (
        <div
          key={s.label}
          className="stat-card px-3.5 py-3 min-w-0"
        >
          {s.label && <div className="kpi-label mb-1 truncate">
            {s.label}
          </div>}
          {s.lines ? (
            <div className="flex items-center">
              {s.lines.map((l: { label: string; count: number; color: string }, i: number) => (
                <React.Fragment key={l.label}>
                  {i > 0 && <div className="mx-2.5 self-stretch" style={{ width: 1, background: "var(--color-border-primary)" }} />}
                  <div className="flex-1 text-center">
                    <div className="kpi-label mb-0.5">{l.label}</div>
                    <div className="kpi-value" style={{ color: l.color }}>{loading ? "—" : l.count}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="kpi-value">
                {s.value}
              </span>
              {s.sub && (
                <span className="kpi-sub" style={{ color: s.color }}>
                  {s.sub}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
