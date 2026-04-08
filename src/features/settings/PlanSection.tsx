import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, Package, X } from 'lucide-react';
import { useT } from '../../i18n/context';
import { api } from '../../lib/api';
import PeepIllustration from '../../components/ui/PeepIllustration';

interface PlanSectionProps {
  showToast: (msg: string) => void;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  deliverySpeed?: string;
  features?: string;
  [key: string]: unknown;
}

export default function PlanSection({ showToast }: PlanSectionProps) {
  const { t } = useT();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", price: "", deliverySpeed: "", features: "" });

  const fetchPlans = async () => { try { setPlans(await api.get<Plan[]>("/api/plans")); } catch (e) { /* API error, silent fallback */ } };
  useEffect(() => { fetchPlans(); }, []);

  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, price: String(p.price || 0), deliverySpeed: p.deliverySpeed || "", features: (JSON.parse(p.features || "[]") as string[]).join("\n") }); };
  const openNew = () => { setEditing("new"); setForm({ name: "", price: "", deliverySpeed: "", features: "" }); };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const data = { name: form.name, price: Number(form.price) || 0, deliverySpeed: form.deliverySpeed, features: JSON.stringify(form.features.split("\n").filter(Boolean)) };
    try {
      if (editing === "new") { await api.post("/api/plans", data); }
      else {
        // Rule 13: only send changed fields
        const orig = editing as Plan;
        const diff: Record<string, unknown> = {};
        if (data.name !== (orig.name || '')) diff.name = data.name;
        if (data.price !== (orig.price || 0)) diff.price = data.price;
        if (data.deliverySpeed !== (orig.deliverySpeed || '')) diff.deliverySpeed = data.deliverySpeed;
        if (data.features !== (orig.features || '[]')) diff.features = data.features;
        if (Object.keys(diff).length > 0) await api.put(`/api/plans/${orig.id}`, diff);
      }
      showToast(t("common.saved"));
      setEditing(null); fetchPlans();
    } catch { showToast(t("common.saveFailed")); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try {
      await api.del(`/api/plans/${id}`);
      showToast(t("settings.planDeleted"));
    } catch (e) {
      console.warn('[PlanSection] deletePlan', e);
      showToast(t("common.deleteFailed"));
    }
    setConfirmDeleteId(null);
    fetchPlans();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <span className="section-label flex items-center gap-1.5"><Package size={14} /> {t("settings.planManager")}</span>
        <button onClick={openNew} className="btn-ghost compact" style={{ color: "var(--color-accent)" }}>
          <Plus size={14} /> {t("common.add")}
        </button>
      </div>

      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {plans.length === 0 && (
          <div className="p-6 text-center">
            <PeepIllustration name="plants" size={100} />
            <div className="text-[15px] mt-2" style={{ color: "var(--color-text-tertiary)" }}>{t("settings.noPlans")}</div>
          </div>
        )}
        {plans.map(p => {
          const features = (() => { try { return JSON.parse(p.features || "[]"); } catch { return []; } })() as string[];
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-[var(--color-bg-tertiary)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)] shrink-0" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                <Package size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{p.name}</div>
                <div className="text-[13px] mt-0.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
                  ${Number(p.price || 0).toLocaleString()}/mo
                  {p.deliverySpeed ? ` · ${p.deliverySpeed}` : ""}
                  {features.length > 0 ? ` · ${features.length} ${t("settings.planFeatures").split('\n')[0]}` : ""}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(p)} className="btn-icon" style={{ color: "var(--color-text-quaternary)" }} aria-label="Edit plan"><Edit2 size={16} /></button>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => del(p.id)} className="text-[14px] px-3 py-1.5 rounded-[var(--radius-6)] transition-colors" style={{ background: "var(--color-danger)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.confirm")}</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[14px] px-3 py-1.5 rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-quaternary)]" style={{ color: "var(--color-text-tertiary)" }}>{t("common.cancel")}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(p.id)} className="btn-icon" style={{ color: "var(--color-danger)" }} aria-label="Delete plan"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit/Add form */}
      {editing && (
        <div className="card p-4 mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {editing === "new" ? t("common.add") : t("common.edit")}
            </div>
            <button onClick={() => setEditing(null)} className="btn-icon" style={{ color: "var(--color-text-quaternary)" }} aria-label="Close"><X size={16} /></button>
          </div>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("settings.planName")} className="input-base w-full px-3 py-2 text-[15px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder={t("settings.planPrice")} type="number" className="input-base w-full px-3 py-2 text-[15px]" />
            <input value={form.deliverySpeed} onChange={e => setForm(p => ({ ...p, deliverySpeed: e.target.value }))} placeholder={t("settings.planSpeed")} className="input-base w-full px-3 py-2 text-[15px]" />
          </div>
          <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder={t("settings.planFeatures")} className="input-base w-full px-3 py-2 text-[15px] h-20 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="btn-secondary text-[15px] flex-1">{t("common.cancel")}</button>
            <button onClick={save} disabled={saving} className="btn-primary text-[15px] flex-1">
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
