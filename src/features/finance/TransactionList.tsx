import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  ChevronRight,
} from "lucide-react";
import { catLabel, STATUS_I18N } from "../../lib/tax";
import { fmtDate, formatMoney } from "../../lib/format";
import { useSettingsStore } from "../../store/useSettingsStore";

/* ── Types ── */
interface TxRecord {
  id: number;
  type?: string;
  amount?: number;
  tax_amount?: number;
  tax_mode?: string;
  source?: string;
  description?: string;
  desc?: string;
  client_name?: string;
  category?: string;
  date?: string;
  status?: string;
  [key: string]: unknown;
}

/* ── Helpers ── */
const stLabel = (st: string, t: (k: string) => string) => {
  const key = STATUS_I18N[st];
  return key ? t(key) : st;
};

/* ── Stat Card ── */
export function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="stat-card anim-appear">
      <div className="flex items-center justify-between mb-1">
        <span className="kpi-label">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)", color }}>{icon}</span>
      </div>
      <div className="kpi-value text-[16px] md:text-[18px] select-all truncate">{value}</div>
      {sub && <div className="text-[13px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{sub}</div>}
    </div>
  );
}

/* ── Transaction Row (memoized) ── */
export const TxRow = React.memo(function TxRow({ tx, t, lang, fmtAmt, fmtAmtColor, onEdit, onDelete, isSystem, expanded, onClientClick }: {
  tx: TxRecord; t: (k: string) => string; lang?: string; fmtAmt: (n: number) => string; fmtAmtColor: (n: number) => string;
  onEdit: () => void; onDelete: () => void; isSystem: boolean; expanded?: boolean; onClientClick?: (name: string) => void;
}) {
  const currency = useSettingsStore((s) => s.currency) || 'USD';
  const rawAmt = Number(tx.amount || 0);
  const tax = Math.abs(Number(tx.tax_amount || 0));
  const isIncome = tx.type === "income";
  const taxMode = tx.tax_mode || 'none';
  // Display logic:
  // - Income: always show pre-tax (amount), tax is collected for gov
  // - Expense exclusive: show amount + tax (total cash out)
  // - Expense inclusive: show amount as-is (tax already included)
  // - Expense none: show amount as-is
  const absAmt = isIncome ? rawAmt
    : taxMode === 'exclusive' ? (rawAmt < 0 ? rawAmt - tax : rawAmt + tax)
    : rawAmt;
  // Expenses display as negative so fmtAmt/fmtAmtColor show -$ in red
  const amt = isIncome ? absAmt : -Math.abs(absAmt);
  const src = tx.source || 'manual';
  // Orphan: system tx whose client was deleted (client_id null but client_name present)
  const isOrphan = src !== 'manual' && !tx.client_id && !!tx.client_name;
  const sourceBadge = src === "subscription"
    ? t("finance.source.subscription")
    : src === "milestone"
    ? (tx.description?.match(/·\s*(.+?)$/)?.[1] || t("finance.source.milestone"))
    : src === "project_fee"
    ? t("finance.source.project")
    : null;
  const taxText = tax > 0
    ? taxMode === "exclusive"
      ? `${t("finance.tax")} ${formatMoney(tax, currency, lang)} · ${t("pipeline.tx.total")} ${formatMoney(rawAmt + tax, currency, lang)}`
      : `${t("pipeline.milestones.amountPreTax")} ${formatMoney(rawAmt - tax, currency, lang)} · ${t("finance.tax")} ${formatMoney(tax, currency, lang)}`
    : "";

  const actionBtns = isSystem ? (
    <span className="btn-icon-sm" title={t("finance.locked.hint")} role="img" aria-label={t("finance.locked.hint")}><Lock size={14} /></span>
  ) : (
    <div className="flex gap-1">
      <button onClick={onEdit} className="btn-icon-sm" aria-label={t("common.edit")}><Edit2 size={14} /></button>
      <button onClick={onDelete} className="btn-icon-sm" aria-label={t("common.delete")}><Trash2 size={14} /></button>
    </div>
  );

  if (expanded) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-3 items-center border-b border-[var(--color-line-secondary)] group hover:bg-[var(--color-bg-tertiary)] transition-colors">
          <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{fmtDate(tx.date || "", lang || "zh")}</span>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-[15px] truncate" style={{ color: isOrphan ? "var(--color-text-tertiary)" : "var(--color-text-primary)", textDecoration: isOrphan ? "line-through" : undefined }}>{tx.description || tx.desc || tx.client_name || "—"}</span>
            {sourceBadge && <span className="badge text-[13px] shrink-0">{sourceBadge}</span>}
          </div>
          <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{catLabel(tx.category || "", t)}</span>
          <div className="text-right">
            <span className="text-[15px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</span>
            {taxText && <div className="text-[12px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{taxText}</div>}
          </div>
          <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</span>
          <div className="flex gap-1">{actionBtns}</div>
        </div>
        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-[var(--color-line-secondary)]" role={isSystem ? undefined : "button"} tabIndex={isSystem ? undefined : 0} onClick={isSystem ? undefined : onEdit} onKeyDown={isSystem ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-6)] ${isIncome ? "icon-circle-success" : "icon-circle-danger"}`}>
            {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] truncate" style={{ color: isOrphan ? "var(--color-text-tertiary)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)", textDecoration: isOrphan ? "line-through" : undefined } as React.CSSProperties}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
              {sourceBadge && <span className="badge text-[13px] shrink-0">{sourceBadge}</span>}
            </div>
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{fmtDate(tx.date || "", lang || "zh")} · {catLabel(tx.category || "", t)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</div>
            {taxText && <div className="text-[12px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{taxText}</div>}
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
          </div>
          {isSystem ? <span className="p-1" style={{ color: "var(--color-text-secondary)" }}><Lock size={16} /></span> : <span className="p-1" style={{ color: "var(--color-text-secondary)", opacity: 0.4 }}><ChevronRight size={16} /></span>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hidden md:flex items-center gap-3 px-1 py-3 border-b group" style={{ borderColor: "var(--color-border-primary)" }}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-6)] ${isIncome ? "icon-circle-success" : "icon-circle-danger"}`}>
          {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
            {sourceBadge && <span className="badge text-[13px] shrink-0">{sourceBadge}</span>}
          </div>
          <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {fmtDate(tx.date || "", lang || "zh")} · {catLabel(tx.category || "", t)}
            {tx.client_name ? <>{" · "}<button className="cursor-pointer hover:underline bg-transparent border-0 p-0 text-[13px]" style={{ color: "var(--color-accent)", font: "inherit" }} onClick={(e) => { e.stopPropagation(); if (tx.client_name) onClientClick?.(tx.client_name); }}>{tx.client_name}</button></> : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</div>
          {taxText && <div className="text-[12px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{taxText}</div>}
          <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
        </div>
        <div className="flex gap-1 shrink-0">{actionBtns}</div>
      </div>

      <div
        className="flex md:hidden gap-3 px-1 py-3 border-b"
        style={{ borderColor: "var(--color-border-primary)" }}
      >
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-6)] ${isIncome ? "icon-circle-success" : "icon-circle-danger"}`}>
          {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="min-w-0 truncate text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
                {sourceBadge && <span className="badge text-[13px] shrink-0">{sourceBadge}</span>}
              </div>
              <div className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>
                {fmtDate(tx.date || "", lang || "zh")} · {catLabel(tx.category || "", t)}
                {tx.client_name ? <>{" · "}<button className="cursor-pointer hover:underline bg-transparent border-0 p-0 text-[13px]" style={{ color: "var(--color-accent)", font: "inherit" }} onClick={(e) => { e.stopPropagation(); if (tx.client_name) onClientClick?.(tx.client_name); }}>{tx.client_name}</button></> : ""}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[15px] tabular-nums" style={{ color: fmtAmtColor(amt), fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{fmtAmt(amt)}</div>
              <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
            </div>
          </div>
          {taxText && <div className="mt-1 text-[12px] leading-snug tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{taxText}</div>}
          {!isSystem && (
            <div className="mt-2 flex items-center justify-end gap-1">
              {actionBtns}
            </div>
          )}
          {isSystem && (
            <div className="mt-1 inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
              <Lock size={12} />
              <span>{t("finance.locked.hint")}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

/* ── Virtual scrolled transaction list ── */
export function VirtualTxList({ items, t, lang, fmtAmt, fmtAmtColor, onEdit, onDelete, onClientClick }: {
  items: TxRecord[]; t: (k: string) => string; lang?: string; fmtAmt: (n: number) => string; fmtAmtColor: (n: number) => string;
  onEdit: (tx: TxRecord) => void; onDelete: (tx: TxRecord) => void; onClientClick?: (name: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto ios-scroll">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map(vRow => {
          const tx = items[vRow.index];
          const isSystem = !!(tx.source && tx.source !== 'manual');
          return (
            <div key={tx.id} data-index={vRow.index} ref={rowVirtualizer.measureElement} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}>
              <TxRow
                tx={tx} t={t} lang={lang} fmtAmt={fmtAmt} fmtAmtColor={fmtAmtColor}
                onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)}
                isSystem={isSystem} expanded onClientClick={onClientClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
