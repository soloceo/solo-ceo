import React, { useState } from 'react';
import { Loader2, Mail, Lock, ArrowRight, UserPlus, LogIn, KeyRound, WifiOff } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useT } from '../i18n/context';
import { supabase } from '../db/supabase-client';

export default function LoginPage() {
  const { signIn, signUp, enterOfflineMode } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || (mode !== 'forgot' && !password)) {
      setError(t('auth.fillAll' as any));
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (e) setError(e.message);
        else setSuccess(t('auth.resetPasswordSent' as any));
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch' as any));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort' as any));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await signUp(email.trim(), password);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(t('auth.checkEmail' as any));
        }
      } else {
        const result = await signIn(email.trim(), password);
        if (result.error) {
          setError(result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--color-bg-primary)', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-full max-w-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-8)] text-2xl"
            style={{ background: 'var(--color-accent)', color: 'var(--color-brand-text)', fontWeight: 'var(--font-weight-bold)' } as React.CSSProperties}
          >
            S
          </div>
          <h1 className="text-xl" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-bold)' } as React.CSSProperties}>
            {t('auth.title' as any)}
          </h1>
          <p className="mt-1 text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('auth.subtitle' as any)}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-tertiary)' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder' as any)}
                className="input-base w-full py-3 pl-10 pr-3 text-[16px]"
                autoComplete="email"
                autoFocus
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder' as any)}
                  className="input-base w-full py-3 pl-10 pr-3 text-[16px]"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder' as any)}
                  className="input-base w-full py-3 pl-10 pr-3 text-[16px]"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {/* Error / Success messages */}
          {error && (
            <div
              className="rounded-[var(--radius-6)] p-3 text-[14px]"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-[var(--radius-6)] p-3 text-[14px]"
              style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
            >
              {success}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-[16px] disabled:opacity-50"
            style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === 'forgot' ? (
              <>
                <KeyRound size={16} />
                {t('auth.resetPasswordBtn' as any)}
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn size={16} />
                {t('auth.loginBtn' as any)}
              </>
            ) : (
              <>
                <UserPlus size={16} />
                {t('auth.registerBtn' as any)}
              </>
            )}
          </button>
        </form>

        {/* Toggle login / register / forgot */}
        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setSuccess('');
            }}
            className="text-[15px]"
            style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}
          >
            {mode === 'forgot'
              ? t('auth.switchToLogin' as any)
              : mode === 'login'
              ? t('auth.switchToRegister' as any)
              : t('auth.switchToLogin' as any)}
          </button>
          {mode === 'login' && (
            <div>
              <button
                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                className="text-[14px]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {t('auth.forgotPassword' as any)}
              </button>
            </div>
          )}
        </div>

        {/* Skip login — offline mode */}
        <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid var(--color-line-secondary)' }}>
          <button
            onClick={enterOfflineMode}
            className="flex items-center justify-center gap-1.5 mx-auto text-[14px] transition-colors hover:opacity-80 press-feedback"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <WifiOff size={14} />
            {t('auth.skipLogin' as any)}
          </button>
          <p className="mt-2 text-[12px] leading-relaxed px-2" style={{ color: 'var(--color-text-quaternary)' }}>
            {t('auth.skipLoginHint' as any)}
          </p>
        </div>
      </div>
    </div>
  );
}
