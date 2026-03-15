import React, { useState } from 'react';
import { Loader2, Mail, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useT } from '../i18n/context';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

    if (!email.trim() || !password) {
      setError(t('auth.fillAll' as any));
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
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            S
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {t('auth.title' as any)}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
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
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder' as any)}
                className="input-base w-full py-3 pl-10 pr-3 text-[14px]"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder' as any)}
                className="input-base w-full py-3 pl-10 pr-3 text-[14px]"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder' as any)}
                  className="input-base w-full py-3 pl-10 pr-3 text-[14px]"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {/* Error / Success messages */}
          {error && (
            <div
              className="rounded-lg p-3 text-[12px]"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-lg p-3 text-[12px]"
              style={{ background: 'var(--success-light)', color: 'var(--success)' }}
            >
              {success}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-[14px] font-medium disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
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

        {/* Toggle login / register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setSuccess('');
            }}
            className="text-[13px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            {mode === 'login'
              ? t('auth.switchToRegister' as any)
              : t('auth.switchToLogin' as any)}
          </button>
        </div>
      </div>
    </div>
  );
}
