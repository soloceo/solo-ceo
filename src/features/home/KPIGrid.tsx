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
      label: null,
      value: null,
      color: "var(--color-accent)",
      lines: [
        { label: t("home.kpi.workTasks" as any), count: workTasks, color: "var(--color-accent)" },
        { label: t("home.kpi.personalTasks" as any), count: personalTasks, color: "var(--color-info)" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="card px-3.5 py-3 min-w-0"
        >
          {s.label && <div className="text-[13px] mb-1 truncate" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {s.label}
          </div>}
          {s.lines ? (
            <div className="flex items-center">
              {s.lines.map((l: any, i: number) => (
                <React.Fragment key={l.label}>
                  {i > 0 && <div className="mx-2.5 self-stretch" style={{ width: 1, background: "var(--color-border-primary)" }} />}
                  <div className="flex-1 text-center">
                    <div className="text-[13px] mb-0.5" style={{ color: "var(--color-text-tertiary)" }}>{l.label}</div>
                    <div className="text-[20px] tabular-nums" style={{ color: l.color, fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>{loading ? "—" : l.count}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className="text-[20px] tracking-tight tabular-nums select-all"
                style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
              >
                {s.value}
              </span>
              {s.sub && (
                <span className="text-[12px] truncate" style={{ color: s.color, fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
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
