import React, { useState } from 'react';
import { Check, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useT } from '../../i18n/context';
import { supabase } from '../../db/supabase-client';

function StatusMsg({ status, message }: { status: 'success' | 'error'; message: string }) {
  const isOk = status === 'success';
  return (
    <div className="p-3 rounded-[var(--radius-6)] text-[11px] flex items-start gap-2" style={{ background: isOk ? 'var(--color-success-light)' : 'var(--color-danger-light)', color: isOk ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {isOk ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface SecuritySectionProps {
  showToast: (msg: string) => void;
}

export default function SecuritySection({ showToast }: SecuritySectionProps) {
  const { t } = useT();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setPwMsg({ status: 'error', message: t('auth.passwordTooShort' as any) });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ status: 'error', message: t('auth.passwordMismatch' as any) });
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setPwMsg({ status: 'error', message: error.message });
      else {
        setPwMsg({ status: 'success', message: t('auth.passwordUpdated' as any) });
        setNewPassword(''); setConfirmPassword('');
      }
    } finally { setPwLoading(false); }
  };

  const handleChangeEmail = async () => {
    setEmailMsg(null);
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailMsg({ status: 'error', message: t('auth.fillAll' as any) });
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) setEmailMsg({ status: 'error', message: error.message });
      else {
        setEmailMsg({ status: 'success', message: t('auth.changeEmailSent' as any) });
        setNewEmail('');
      }
    } finally { setEmailLoading(false); }
  };

  return (
    <section>
      <SectionLabel>{t("settings.accountSecurity" as any)}</SectionLabel>
      <div className="card p-5 space-y-5">
        {/* Change Password */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <span className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("auth.changePassword" as any)}</span>
          </div>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("auth.newPassword" as any)} className="input-base w-full px-3 py-2 text-[13px]" autoComplete="new-password" />
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("auth.confirmNewPassword" as any)} className="input-base w-full px-3 py-2 text-[13px]" autoComplete="new-password" />
          {pwMsg && <StatusMsg status={pwMsg.status} message={pwMsg.message} />}
          <button onClick={handleChangePassword} disabled={pwLoading} className="btn-primary text-[13px] px-4 py-2 disabled:opacity-50">
            {pwLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("auth.changePassword" as any)}
          </button>
        </div>

        <div className="border-t" style={{ borderColor: 'var(--color-border-primary)' }} />

        {/* Change Email */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <span className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("auth.changeEmail" as any)}</span>
          </div>
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t("auth.newEmail" as any)} className="input-base w-full px-3 py-2 text-[13px]" autoComplete="email" />
          <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{t("auth.changeEmailHint" as any)}</div>
          {emailMsg && <StatusMsg status={emailMsg.status} message={emailMsg.message} />}
          <button onClick={handleChangeEmail} disabled={emailLoading} className="btn-primary text-[13px] px-4 py-2 disabled:opacity-50">
            {emailLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("auth.changeEmail" as any)}
          </button>
        </div>
      </div>
    </section>
  );
}
