import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, Package } from 'lucide-react';
import { useT } from '../../i18n/context';

interface PlanSectionProps {
  showToast: (msg: string) => void;
}

export default function PlanSection({ showToast }: PlanSectionProps) {
  const { t } = useT();
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", deliverySpeed: "", features: "" });

  const fetchPlans = async () => { try { setPlans(await (await fetch("/api/plans")).json()); } catch {} };
  useEffect(() => { fetchPlans(); }, []);

  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, price: String(p.price || 0), deliverySpeed: p.deliverySpeed || "", features: (JSON.parse(p.features || "[]") as string[]).join("\n") }); };
  const openNew = () => { setEditing("new"); setForm({ name: "", price: "", deliverySpeed: "", features: "" }); };

  const save = async () => {
    const data = { name: form.name, price: Number(form.price) || 0, deliverySpeed: form.deliverySpeed, features: JSON.stringify(form.features.split("\n").filter(Boolean)) };
    try {
      if (editing === "new") { await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); }
      else { await fetch(`/api/plans/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); }
      showToast(t("common.saved" as any));
      setEditing(null); fetchPlans();
    } catch { showToast("Error"); }
  };

  const del = async (id: number) => {
    if (!confirm(t("common.confirmDelete" as any))) return;
    await fetch(`/api/plans/${id}`, { method: "DELETE" }); fetchPlans();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="section-label flex items-center gap-1.5"><Package size={16} /> {t("settings.planManager" as any)}</span>
        <button onClick={openNew} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("common.add" as any)}</button>
      </div>
      <div className="card divide-y" style={{ borderColor: "var(--color-border-primary)" }}>
        {plans.length === 0 && <div className="p-4 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("settings.noPlans" as any)}</div>}
        {plans.map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{p.name}</div>
              <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>${Number(p.price || 0).toLocaleString()}/mo {p.deliverySpeed ? `· ${p.deliverySpeed}` : ""}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(p)} className="btn-ghost p-1.5"><Edit2 size={16} /></button>
              <button onClick={() => del(p.id)} className="btn-ghost p-1.5" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="card p-4 mt-3 space-y-3">
          <div className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{editing === "new" ? t("common.add" as any) : t("common.edit" as any)}</div>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("settings.planName" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder={t("settings.planPrice" as any)} type="number" className="input-base w-full px-3 py-2 text-[13px]" />
            <input value={form.deliverySpeed} onChange={e => setForm(p => ({ ...p, deliverySpeed: e.target.value }))} placeholder={t("settings.planSpeed" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
          </div>
          <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder={t("settings.planFeatures" as any)} className="input-base w-full px-3 py-2 text-[13px] h-20 resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="btn-secondary text-[13px] px-4 py-2">{t("common.cancel" as any)}</button>
            <button onClick={save} className="btn-primary text-[13px] px-4 py-2">{t("common.save" as any)}</button>
          </div>
        </div>
      )}
    </section>
  );
}
