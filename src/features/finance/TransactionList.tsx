import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import SwipeAction from "../../components/SwipeAction";
import {
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  ChevronRight,
} from "lucide-react";
import { catLabel, STATUS_I18N } from "../../lib/tax";

/* ── Helpers ── */
const stLabel = (st: string, t: (k: any) => string) => {
  const key = STATUS_I18N[st];
  return key ? t(key as any) : st;
};

/* ── Stat Card ── */
export function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-lg tracking-tight" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{sub}</div>}
    </div>
  );
}

/* ── Transaction Row (memoized) ── */
export const TxRow = React.memo(function TxRow({ tx, t, fmtAmt, fmtAmtColor, onEdit, onDelete, isSystem, expanded }: {
  tx: any; t: (k: any) => string; fmtAmt: (n: number) => string; fmtAmtColor: (n: number) => string;
  onEdit: () => void; onDelete: () => void; isSystem: boolean; expanded?: boolean;
}) {
  const rawAmt = Number(tx.amount || 0);
  const tax = Math.abs(Number(tx.tax_amount || 0));
  const isIncome = tx.type === "income" || rawAmt > 0;
  const taxMode = tx.tax_mode || 'none';
  // Display logic:
  // - Income: always show pre-tax (amount), tax is collected for gov
  // - Expense exclusive: show amount + tax (total cash out)
  // - Expense inclusive: show amount as-is (tax already included)
  // - Expense none: show amount as-is
  const amt = isIncome ? rawAmt
    : taxMode === 'exclusive' ? (rawAmt < 0 ? rawAmt - tax : rawAmt + tax)
    : rawAmt;
  const src = tx.source || 'manual';
  const sourceBadge = src === "subscription"
    ? t("finance.source.subscription" as any)
    : src === "milestone"
    ? t("finance.source.milestone" as any)
    : src === "project_fee"
    ? t("finance.source.project" as any)
    : null;

  const actionBtns = isSystem ? (
    <span className="p-1 rounded-[var(--radius-4)]" style={{ color: "var(--color-text-secondary)" }} title={t("finance.locked.hint" as any)}><Lock size={16} /></span>
  ) : (
    <>
      <button onClick={onEdit} className="p-1.5 rounded-[var(--radius-4)]" style={{ color: "var(--color-text-secondary)" }} aria-label={t("common.edit" as any)}><Edit2 size={16} /></button>
      <button onClick={onDelete} className="p-1.5 rounded-[var(--radius-4)]" style={{ color: "var(--color-text-secondary)" }} aria-label={t("common.delete" as any)}><Trash2 size={16} /></button>
    </>
  );

  if (expanded) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-3 items-center border-b group hover:bg-[var(--color-bg-tertiary)] transition-colors" style={{ borderColor: "var(--color-border-primary)" }}>
          <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{tx.date || "—"}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)" }}>{tx.description || tx.desc || tx.client_name || "—"}</span>
            {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
          </div>
          <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{catLabel(tx.category || "", t)}</span>
          <div className="text-right">
            <span className="text-[13px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</span>
            {tax > 0 && <div className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{taxMode === "exclusive" ? `+${t("finance.tax" as any)} $${tax.toLocaleString()}` : taxMode === "inclusive" ? `${t("finance.taxIncluded" as any)} $${tax.toLocaleString()}` : ""}</div>}
          </div>
          <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</span>
          <div className="flex gap-1">{actionBtns}</div>
        </div>
        {/* Mobile — swipe left to delete */}
        <SwipeAction onDelete={onDelete} disabled={isSystem}>
          <div className="flex md:hidden items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--color-border-primary)" }} onClick={isSystem ? undefined : onEdit}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-6)]" style={{ background: isIncome ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
              {isIncome ? <ArrowUpRight size={16} style={{ color: "var(--color-success, #22c55e)" }} /> : <ArrowDownRight size={16} style={{ color: "var(--color-danger, #ef4444)" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
                {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
              </div>
              <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{tx.date || "—"} · {catLabel(tx.category || "", t)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</div>
              {tax > 0 && <div className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{taxMode === "exclusive" ? `+${t("finance.tax" as any)} $${tax.toLocaleString()}` : taxMode === "inclusive" ? `${t("finance.taxIncluded" as any)} $${tax.toLocaleString()}` : ""}</div>}
              <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
            </div>
            {isSystem ? <span className="p-1" style={{ color: "var(--color-text-secondary)" }}><Lock size={16} /></span> : <span className="p-1" style={{ color: "var(--color-text-secondary)", opacity: 0.4 }}><ChevronRight size={16} /></span>}
          </div>
        </SwipeAction>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1 py-3 border-b group" style={{ borderColor: "var(--color-border-primary)" }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-6)]" style={{ background: isIncome ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
        {isIncome ? <ArrowUpRight size={16} style={{ color: "var(--color-success, #22c55e)" }} /> : <ArrowDownRight size={16} style={{ color: "var(--color-danger, #ef4444)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
          {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
        </div>
        <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
          {tx.date || "—"} · {catLabel(tx.category || "", t)}
          {tx.client_name ? ` · ${tx.client_name}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</div>
        <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
      </div>
      <div className="flex gap-1 shrink-0">{actionBtns}</div>
    </div>
  );
});

/* ── Virtual scrolled transaction list ── */
export function VirtualTxList({ items, t, fmtAmt, fmtAmtColor, onEdit, onDelete }: {
  items: any[]; t: any; fmtAmt: any; fmtAmtColor: any;
  onEdit: (tx: any) => void; onDelete: (tx: any) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto ios-scroll">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map(vRow => {
          const tx = items[vRow.index];
          const isSystem = tx.source && tx.source !== 'manual';
          return (
            <div key={tx.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}>
              <TxRow
                tx={tx} t={t} fmtAmt={fmtAmt} fmtAmtColor={fmtAmtColor}
                onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)}
                isSystem={isSystem} expanded
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
