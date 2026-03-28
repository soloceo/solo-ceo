import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { BarChart3, TrendingUp, TrendingDown, Users, UserPlus, CheckCircle2, X, DollarSign } from "lucide-react";
import { useT } from "../../i18n/context";
import { EmptyState } from "../../components/ui/EmptyState";

interface ReportData {
  weekStart: string;
  weekEnd: string;
  income: number;
  expenses: number;
  netIncome: number;
  tasksCompleted: number;
  newClients: number;
  newLeads: number;
}

interface WeeklyReportProps {
  open: boolean;
  onClose: () => void;
}

export function WeeklyReport({ open, onClose }: WeeklyReportProps) {
  const { t, lang } = useT();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/weekly-report")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  };

  const period = data
    ? String(t("home.report.period" as any) || "").replace("{start}", formatDate(data.weekStart)).replace("{end}", formatDate(data.weekEnd))
    : "";

  const stats = data ? [
    {
      label: t("home.report.income" as any),
      value: `$${data.income.toLocaleString()}`,
      icon: <TrendingUp size={14} />,
      color: "var(--color-success)",
    },
    {
      label: t("home.report.expenses" as any),
      value: `$${data.expenses.toLocaleString()}`,
      icon: <TrendingDown size={14} />,
      color: "var(--color-danger)",
    },
    {
      label: t("home.report.netIncome" as any),
      value: `${data.netIncome >= 0 ? "+" : ""}$${data.netIncome.toLocaleString()}`,
      icon: <DollarSign size={14} />,
      color: data.netIncome >= 0 ? "var(--color-success)" : "var(--color-danger)",
      highlight: true,
    },
    {
      label: t("home.report.tasksCompleted" as any),
      value: String(data.tasksCompleted),
      icon: <CheckCircle2 size={14} />,
      color: "var(--color-warning)",
    },
    {
      label: t("home.report.newClients" as any),
      value: String(data.newClients),
      icon: <Users size={14} />,
      color: "var(--color-blue)",
    },
    {
      label: t("home.report.newLeads" as any),
      value: String(data.newLeads),
      icon: <UserPlus size={14} />,
      color: "var(--color-accent)",
    },
  ] : [];

  return createPortal(
    <div className="mobile-sheet-overlay" onClick={onClose}>
      <div className="mobile-sheet-content" role="dialog" aria-modal="true" aria-label="Weekly report" onClick={(e) => e.stopPropagation()}>
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: "var(--color-bg-quaternary)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--color-border-primary)" }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} style={{ color: "var(--color-accent)" }} />
            <h2 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {t("home.report.title" as any)}
            </h2>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close report">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto ios-scroll">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-bone h-16 rounded-[var(--radius-12)]" />
              ))}
            </div>
          ) : !data ? (
            <EmptyState title={t("home.report.noData" as any)} />
          ) : (
            <>
              {/* Period badge */}
              <div className="mb-4 text-center">
                <span className="badge text-[14px]">{period}</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="card px-4 py-3"
                    style={s.highlight ? { border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)` } : undefined}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-4)]"
                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}
                      >
                        {s.icon}
                      </div>
                      <span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                        {s.label}
                      </span>
                    </div>
                    <div
                      className="text-[17px] tabular-nums tracking-tight"
                      style={{ color: s.highlight ? s.color : "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
