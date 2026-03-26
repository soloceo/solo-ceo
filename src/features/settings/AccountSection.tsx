import React from 'react';
import { Cloud, CloudOff, LogOut } from 'lucide-react';
import { useT } from '../../i18n/context';
import type { User } from '@supabase/supabase-js';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface AccountSectionProps {
  user: User | null;
  isOnline: boolean;
  pendingOps: number;
  signOut: () => void;
}

export default function AccountSection({ user, isOnline, pendingOps, signOut }: AccountSectionProps) {
  const { t } = useT();

  return (
    <section>
      <SectionLabel>{t("settings.cloudSync" as any)}</SectionLabel>
      <div className="card p-5 space-y-4">
        {/* Account info */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[13px]" style={{ background: 'var(--color-accent)', color: '#fff', fontWeight: 'var(--font-weight-bold)' } as React.CSSProperties}>
              {(user.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {user.email}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {t("auth.loggedInAs" as any, { email: user.email || '' })}
              </div>
            </div>
          </div>
        )}

        {/* Sync status */}
        <div className="flex items-center gap-3 rounded-[var(--radius-6)] p-3" style={{ background: 'var(--color-bg-tertiary)' }}>
          {isOnline ? (
            <Cloud size={20} style={{ color: 'var(--color-success)' }} />
          ) : (
            <CloudOff size={20} style={{ color: 'var(--color-warning)' }} />
          )}
          <div className="flex-1">
            <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
              {isOnline
                ? t("settings.cloudSync.connected" as any)
                : t("settings.cloudSync.offline" as any)}
            </div>
            {pendingOps > 0 && (
              <div className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                {t("settings.cloudSync.pending" as any, { count: String(pendingOps) })}
              </div>
            )}
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-[13px] px-4 py-3 rounded-[var(--radius-6)] w-full justify-center transition-colors"
          style={{ border: '1px solid var(--color-border-primary)', color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}
        >
          <LogOut size={16} />
          {t("auth.logoutBtn" as any)}
        </button>
      </div>
    </section>
  );
}
