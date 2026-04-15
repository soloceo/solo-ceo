import React, { useState } from 'react';
import { Check, Lock, Mail, AlertCircle, Loader2, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useT } from '../../i18n/context';
import { supabase } from '../../db/supabase-client';

function StatusMsg({ status, message }: { status: 'success' | 'error'; message: string }) {
  const isOk = status === 'success';
  return (
    <div className="p-3 rounded-[var(--radius-6)] text-[14px] flex items-start gap-2" style={{ background: isOk ? 'var(--color-success-light)' : 'var(--color-danger-light)', color: isOk ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {isOk ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

export default function SecuritySection() {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!newPassword || newPassword.length < 8) {
      setPwMsg({ status: 'error', message: t('auth.passwordTooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ status: 'error', message: t('auth.passwordMismatch') });
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setPwMsg({ status: 'error', message: error.message });
      else {
        setPwMsg({ status: 'success', message: t('auth.passwordUpdated') });
        setNewPassword(''); setConfirmPassword('');
      }
    } finally { setPwLoading(false); }
  };

  const handleChangeEmail = async () => {
    setEmailMsg(null);
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setEmailMsg({ status: 'error', message: t('auth.fillAll') });
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) setEmailMsg({ status: 'error', message: error.message });
      else {
        setEmailMsg({ status: 'success', message: t('auth.changeEmailSent') });
        setNewEmail('');
      }
    } finally { setEmailLoading(false); }
  };

  return (
    <section>
      <SectionLabel>{t("settings.accountSecurity")}</SectionLabel>
      <div className="card card-glow overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              <Shield size={20} />
            </div>
            <div>
              <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {t("settings.accountSecurity")}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {t("auth.changePassword")} · {t("auth.changeEmail")}
              </div>
            </div>
          </div>
          {expanded ? <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-tertiary)' }} />}
        </button>

        {/* Expandable content */}
        {expanded && (
          <div className="px-4 pb-5 space-y-5" style={{ borderTop: '1px solid var(--color-line-secondary)' }}>

            {/* Change Password */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <Lock size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-[14px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
                  {t("auth.changePassword")}
                </span>
              </div>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("auth.newPassword")} className="input-base w-full px-3 py-2.5 text-[15px]" autoComplete="new-password" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("auth.confirmNewPassword")} className="input-base w-full px-3 py-2.5 text-[15px]" autoComplete="new-password" />
              {pwMsg && <StatusMsg status={pwMsg.status} message={pwMsg.message} />}
              <button onClick={handleChangePassword} disabled={pwLoading} className="btn-primary text-[15px] w-full disabled:opacity-50">
                {pwLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {t("auth.changePassword")}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--color-line-secondary)' }} />

            {/* Change Email */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-[14px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
                  {t("auth.changeEmail")}
                </span>
              </div>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t("auth.newEmail")} className="input-base w-full px-3 py-2.5 text-[15px]" autoComplete="email" />
              <div className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>{t("auth.changeEmailHint")}</div>
              {emailMsg && <StatusMsg status={emailMsg.status} message={emailMsg.message} />}
              <button onClick={handleChangeEmail} disabled={emailLoading} className="btn-primary text-[15px] w-full disabled:opacity-50">
                {emailLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {t("auth.changeEmail")}
              </button>
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
