import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface ChartDataPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
  label: string;
}

interface FinanceChartProps {
  chartData: ChartDataPoint[];
  isMobile: boolean;
  t: (k: string) => string;
}

export default function FinanceChart({ chartData, isMobile, t }: FinanceChartProps) {
  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.chart.title")}</h3>
          <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.chart.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[var(--radius-4)]" style={{ background: "var(--color-success)" }} />{t("money.chart.revenue")}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[var(--radius-4)]" style={{ background: "var(--color-danger)" }} />{t("money.chart.expense")}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[var(--radius-4)]" style={{ background: "var(--color-accent)" }} />{t("money.chart.net")}</span>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: isMobile ? 0 : -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
            {/* Recharts SVG tick requires numeric fontSize — CSS vars not supported */}
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "var(--color-bg-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "var(--radius-8)", fontSize: "var(--font-size-xs)" }}
              formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === "income" ? t("money.chart.revenue") : name === "expense" ? t("money.chart.expense") : t("money.chart.net")]}
              labelFormatter={(label: string) => `${label}${t("money.monthSuffix")}`}
            />
            <Bar dataKey="income" fill="var(--color-success)" radius={[3, 3, 0, 0]} opacity={0.8} isAnimationActive />
            <Bar dataKey="expense" fill="var(--color-danger)" radius={[3, 3, 0, 0]} opacity={0.8} isAnimationActive />
            <Line type="monotone" dataKey="net" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-accent)" }} isAnimationActive />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
