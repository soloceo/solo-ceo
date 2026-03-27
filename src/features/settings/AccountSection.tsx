import React from 'react';
import { Cloud, CloudOff, LogOut, User } from 'lucide-react';
import { useT } from '../../i18n/context';
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
  const { t } = useT();

  return (
    <section>
      <SectionLabel>{t("settings.cloudSync" as any)}</SectionLabel>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">

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
                {t("auth.loggedInAs" as any, { email: user.email || '' })}
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
                ? t("settings.cloudSync.connected" as any)
                : t("settings.cloudSync.offline" as any)}
            </div>
            {pendingOps > 0 && (
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-warning)' }}>
                {t("settings.cloudSync.pending" as any, { count: String(pendingOps) })}
              </div>
            )}
          </div>
          {/* Status dot */}
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isOnline ? 'var(--color-success)' : 'var(--color-warning)' }} />
        </div>

        {/* Logout */}
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
            {t("auth.logoutBtn" as any)}
          </span>
        </button>
      </div>
    </section>
  );
}
