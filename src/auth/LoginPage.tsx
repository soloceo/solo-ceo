import React, { useState } from 'react';
import { Loader2, Mail, Lock, ArrowRight, UserPlus, LogIn, KeyRound, WifiOff, Globe } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useT } from '../i18n/context';
import { supabase } from '../db/supabase-client';
import PeepIllustration from '../components/ui/PeepIllustration';

export default function LoginPage() {
  const { signIn, signUp, enterOfflineMode } = useAuth();
  const { t, lang, setLang } = useT();
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
      setError(t('auth.fillAll'));
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (e) setError(e.message);
        else setSuccess(t('auth.resetPasswordSent'));
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await signUp(email.trim(), password);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(t('auth.checkEmail'));
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
      className="relative flex min-h-[100dvh] flex-col lg:flex-row"
      style={{ background: 'var(--color-bg-primary)', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Language toggle — top right */}
      <button
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-6)] text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
        style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Globe size={14} />
        {lang === 'zh' ? 'EN' : '中文'}
      </button>

      {/* ═══ Left panel — illustration + brand (cohesive hero block) ═══ */}
      <div
        className="flex items-center justify-center px-8 py-8 lg:w-[45%] lg:min-h-screen"
        style={{ background: 'var(--color-accent-tint)' }}
      >
        <div className="flex flex-col items-center gap-4 lg:gap-6">
          <PeepIllustration name="feliz" size={160} className="lg:!w-[280px] lg:!h-[280px]" />
          {/* Brand text — always visible inside hero */}
          <div className="text-center">
            <h1 className="text-xl lg:text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-bold)' } as React.CSSProperties}>
              {t('auth.title')}
            </h1>
            <p className="mt-1 text-[14px] lg:text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('auth.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Right panel — form ═══ */}
      <div
        className="flex flex-1 items-start lg:items-center justify-center px-6 pt-8 pb-10 lg:px-12 lg:w-[55%] lg:min-h-screen"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="w-full max-w-[360px]">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="input-base w-full py-3 pl-10 pr-4 text-[16px]"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="input-base w-full py-3 pl-10 pr-4 text-[16px]"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                </div>
              )}

              {mode === 'register' && (
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="input-base w-full py-3 pl-10 pr-4 text-[16px]"
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>

            {/* Forgot password — inline under inputs, before button */}
            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-[13px]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            {/* Error / Success messages */}
            {error && (
              <div
                className="rounded-[var(--radius-6)] px-3.5 py-2.5 text-[14px]"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="rounded-[var(--radius-6)] px-3.5 py-2.5 text-[14px]"
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
                  {t('auth.resetPasswordBtn')}
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  {t('auth.loginBtn')}
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  {t('auth.registerBtn')}
                </>
              )}
            </button>
          </form>

          {/* Toggle login / register */}
          <div className="mt-6 text-center">
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
                ? t('auth.switchToLogin')
                : mode === 'login'
                ? t('auth.switchToRegister')
                : t('auth.switchToLogin')}
            </button>
          </div>

          {/* Skip login — offline mode */}
          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid var(--color-line-secondary)' }}>
            <button
              onClick={enterOfflineMode}
              className="flex items-center justify-center gap-1.5 mx-auto text-[13px] transition-colors hover:opacity-80 press-feedback"
              style={{ color: 'var(--color-text-quaternary)' }}
            >
              <WifiOff size={13} />
              {t('auth.skipLogin')}
            </button>
            <p className="mt-1.5 text-[11px] leading-relaxed px-4" style={{ color: 'var(--color-text-quaternary)' }}>
              {t('auth.skipLoginHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
