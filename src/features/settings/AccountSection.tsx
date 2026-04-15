import React, { useState } from 'react';
import { Cloud, CloudOff, LogOut, LogIn, User, Download, Upload, Loader2, Check } from 'lucide-react';
import { useT } from '../../i18n/context';
import { api } from '../../lib/api';
import { useUIStore } from '../../store/useUIStore';
import type { User as SupaUser } from '@supabase/supabase-js';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface AccountSectionProps {
  user: SupaUser | null;
  isOnline: boolean;
  pendingOps: number;
  signOut: () => void;
}

export default function AccountSection({ user, isOnline, pendingOps, signOut }: AccountSectionProps) {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const [exporting, setExporting] = useState(false);

  return (
    <section>
      <SectionLabel>{t("settings.cloudSync")}</SectionLabel>
      <div className="card card-glow overflow-hidden divide-y divide-[var(--color-line-secondary)]">

        {/* Account info */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
            >
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] truncate" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {user.email}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {t("auth.loggedInAs", { email: user.email || '' })}
              </div>
            </div>
          </div>
        )}

        {/* Sync status */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]"
            style={{
              background: isOnline
                ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
                : 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
              color: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {isOnline ? <Cloud size={20} /> : <CloudOff size={20} />}
          </div>
          <div className="flex-1">
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
              {isOnline
                ? t("settings.cloudSync.connected")
                : t("settings.cloudSync.offline")}
            </div>
            {pendingOps > 0 && (
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-warning)' }}>
                {t("settings.cloudSync.pending", { count: String(pendingOps) })}
              </div>
            )}
          </div>
          {/* Status dot */}
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isOnline ? 'var(--color-success)' : 'var(--color-warning)' }} />
        </div>

        {/* Backup / Restore */}
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const [tasks, clients, leads, finance] = await Promise.all([
                  api.get("/api/tasks"),
                  api.get("/api/clients"),
                  api.get("/api/leads"),
                  api.get("/api/finance"),
                ]);
                const backup = { version: 1, date: new Date().toISOString(), tasks, clients, leads, finance };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `solo-ceo-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(t("settings.backupSuccess"));
              } catch (e) {
                console.warn('[AccountSection] backup', e);
                showToast(t("settings.backupFailed"));
              } finally {
                setExporting(false);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-6)] text-[14px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {t("settings.backup")}
          </button>
          <label
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-6)] text-[14px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}
          >
            <Upload size={16} />
            {t("settings.restore")}
            <input type="file" accept=".json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.version || !data.tasks) {
                  showToast(t("settings.restoreInvalid"));
                  return;
                }
                showToast(lang === "zh" ? `备份：${data.tasks?.length || 0} 个任务、${data.clients?.length || 0} 个客户。请联系支持恢复。` : `Backup: ${data.tasks?.length || 0} tasks, ${data.clients?.length || 0} clients. Contact support.`);
              } catch (e2) {
                console.warn('[AccountSection] restore', e2);
                showToast(t("settings.restoreInvalid"));
              }
              e.target.value = "";
            }} />
          </label>
        </div>


        {/* Login (offline mode) or Logout */}
        {user ? (
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}
            >
              <LogOut size={20} />
            </div>
            <span className="text-[15px]" style={{ color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
              {t("auth.logoutBtn")}
            </span>
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
            >
              <LogIn size={20} />
            </div>
            <div>
              <span className="text-[15px] block" style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {t("auth.loginOrRegister")}
              </span>
              <span className="text-[13px] block" style={{ color: 'var(--color-text-tertiary)' }}>
                {t("auth.loginOrRegisterHint")}
              </span>
            </div>
          </button>
        )}
      </div>
    </section>
  );
}
