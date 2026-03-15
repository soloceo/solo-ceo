import React, { useState, useEffect } from 'react';
import { Key, Save, Check, ExternalLink, Play, Loader2, AlertCircle, Upload, Trash2, Moon, Sun, Globe, LogOut, Cloud, CloudOff } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useT, type Lang } from '../i18n/context';
import { useAuth } from '../auth/AuthProvider';
import { getQueueLength } from '../db/offline-queue';

/* ── Sub-components ────────────────────────────────────────────── */

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-5 py-2.5 rounded-lg z-[9999] flex items-center gap-2 text-[13px] font-medium" style={{ background: 'var(--text)', color: 'var(--bg)', boxShadow: 'var(--shadow-md)' }}>
      <Check size={14} style={{ color: 'var(--success)' }} /> {message}
    </div>
  );
}

function StatusMsg({ status, message }: { status: 'success' | 'error'; message: string }) {
  const isOk = status === 'success';
  return (
    <div className="p-3 rounded-lg text-[11px] flex items-start gap-2" style={{ background: isOk ? 'var(--success-light)' : 'var(--danger-light)', color: isOk ? 'var(--success)' : 'var(--danger)' }}>
      {isOk ? <Check size={12} className="mt-0.5 shrink-0" /> : <AlertCircle size={12} className="mt-0.5 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function Settings() {
  const { t, lang, setLang } = useT();
  const { user, signOut } = useAuth();
  const [operatorName, setOperatorName] = useState('Andy');
  const [operatorAvatar, setOperatorAvatar] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [imageApiKey, setImageApiKey] = useState('');
  const [imageModel, setImageModel] = useState('imagen-4.0-generate-001');
  const [imageProvider, setImageProvider] = useState('google');
  const [toast, setToast] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [testStates, setTestStates] = useState<Record<string, { status: 'idle' | 'testing' | 'success' | 'error'; message: string }>>({
    gemini: { status: 'idle', message: '' },
    openai: { status: 'idle', message: '' },
    claude: { status: 'idle', message: '' },
  });

  // Cloud sync state
  const [pendingOps, setPendingOps] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    setOperatorName(localStorage.getItem('OPERATOR_NAME') || 'Andy');
    setOperatorAvatar(localStorage.getItem('OPERATOR_AVATAR') || '');
    setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setOpenaiKey(localStorage.getItem('OPENAI_API_KEY') || '');
    setClaudeKey(localStorage.getItem('CLAUDE_API_KEY') || '');
    setImageApiKey(localStorage.getItem('IMAGE_API_KEY') || '');
    setImageModel(localStorage.getItem('IMAGE_MODEL') || 'imagen-4.0-generate-001');
    setImageProvider(localStorage.getItem('IMAGE_PROVIDER') || 'google');
    setDarkMode(localStorage.getItem('DARK_MODE') === 'true');

    // Check pending offline ops
    getQueueLength().then(setPendingOps).catch(() => {});

    // Listen for online/offline events
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPendingOps(detail?.pending || 0);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('sync-status', onSyncStatus);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('sync-status', onSyncStatus);
    };
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('DARK_MODE', String(next));
  };

  /* ── Save ── */
  const handleSave = () => {
    const cleanedOperatorName = operatorName.trim() || 'Andy';
    localStorage.setItem('OPERATOR_NAME', cleanedOperatorName);
    setOperatorName(cleanedOperatorName);
    localStorage.setItem('OPERATOR_AVATAR', operatorAvatar || '');
    window.dispatchEvent(new Event('operator-name-updated'));
    window.dispatchEvent(new Event('operator-avatar-updated'));
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OPERATOR_NAME: cleanedOperatorName, OPERATOR_AVATAR: operatorAvatar || '' }),
    }).catch(() => {});

    const cleanedGemini = geminiKey.trim().replace(/^["']|["']$/g, '');
    cleanedGemini ? localStorage.setItem('GEMINI_API_KEY', cleanedGemini) : localStorage.removeItem('GEMINI_API_KEY');
    const cleanedOpenai = openaiKey.trim().replace(/^["']|["']$/g, '');
    cleanedOpenai ? localStorage.setItem('OPENAI_API_KEY', cleanedOpenai) : localStorage.removeItem('OPENAI_API_KEY');
    const cleanedClaude = claudeKey.trim().replace(/^["']|["']$/g, '');
    cleanedClaude ? localStorage.setItem('CLAUDE_API_KEY', cleanedClaude) : localStorage.removeItem('CLAUDE_API_KEY');
    const cleanedImageApiKey = imageApiKey.trim().replace(/^["']|["']$/g, '');
    cleanedImageApiKey ? localStorage.setItem('IMAGE_API_KEY', cleanedImageApiKey) : localStorage.removeItem('IMAGE_API_KEY');
    const cleanedImageModel = imageModel.trim();
    cleanedImageModel ? localStorage.setItem('IMAGE_MODEL', cleanedImageModel) : localStorage.removeItem('IMAGE_MODEL');
    localStorage.setItem('IMAGE_PROVIDER', imageProvider);
    showToast(t("settings.saved" as any));
  };

  /* ── Avatar ── */
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t("settings.avatarInvalid" as any)); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setOperatorAvatar(result);
      localStorage.setItem('OPERATOR_AVATAR', result);
      window.dispatchEvent(new Event('operator-avatar-updated'));
      showToast(t("settings.avatarUpdated" as any));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clearAvatar = () => {
    setOperatorAvatar('');
    localStorage.removeItem('OPERATOR_AVATAR');
    window.dispatchEvent(new Event('operator-avatar-updated'));
    showToast(t("settings.avatarRemoved" as any));
  };

  /* ── Test API keys ── */
  const updateTestState = (provider: string, status: 'idle' | 'testing' | 'success' | 'error', message: string) => {
    setTestStates(prev => ({ ...prev, [provider]: { status, message } }));
  };

  const handleTestKey = async (provider: 'gemini' | 'openai' | 'claude') => {
    const keyMap = { gemini: geminiKey, openai: openaiKey, claude: claudeKey };
    const cleaned = keyMap[provider].trim().replace(/^["']|["']$/g, '');
    if (!cleaned) { updateTestState(provider, 'error', t("settings.apiKeys.enterFirst" as any)); return; }
    updateTestState(provider, 'testing', '');

    try {
      if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: cleaned });
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Say 'OK'" });
        if (response.text) {
          updateTestState(provider, 'success', t("settings.apiKeys.testSuccess" as any));
          localStorage.setItem('GEMINI_API_KEY', cleaned);
        } else throw new Error(t("settings.apiKeys.noResponse" as any));
      } else if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${cleaned}` },
        });
        if (res.ok) {
          updateTestState(provider, 'success', t("settings.apiKeys.testSuccess" as any));
          localStorage.setItem('OPENAI_API_KEY', cleaned);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }
      } else if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': cleaned,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] }),
        });
        if (res.ok) {
          updateTestState(provider, 'success', t("settings.apiKeys.testSuccess" as any));
          localStorage.setItem('CLAUDE_API_KEY', cleaned);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }
      }
    } catch (error: any) {
      updateTestState(provider, 'error', t("settings.apiKeys.testFailed" as any, { error: error.message || 'Unknown error' }));
    }
  };

  const apiKeys = [
    { key: 'gemini', label: 'Gemini API Key', badge: t("settings.apiKeys.recommended" as any), desc: t("settings.apiKeys.geminiDesc" as any), value: geminiKey, onChange: setGeminiKey, placeholder: 'AI Studio Gemini API Key', linkUrl: 'https://aistudio.google.com/app/apikey', linkLabel: t("settings.apiKeys.getKey" as any) },
    { key: 'openai', label: 'OpenAI API Key', desc: t("settings.apiKeys.openaiDesc" as any), value: openaiKey, onChange: setOpenaiKey, placeholder: 'sk-...', linkUrl: 'https://platform.openai.com/api-keys', linkLabel: t("settings.apiKeys.getKey" as any) },
    { key: 'claude', label: 'Claude API Key', desc: t("settings.apiKeys.claudeDesc" as any), value: claudeKey, onChange: setClaudeKey, placeholder: 'sk-ant-...', linkUrl: 'https://console.anthropic.com/settings/keys', linkLabel: t("settings.apiKeys.getKey" as any) },
  ] as const;

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="mobile-page max-w-2xl mx-auto px-4 py-4 md:px-8 md:py-6 lg:py-8 relative">
      <Toast message={toast} />

      {/* Header */}
      <header className="mb-6">
        <h1 className="page-title">{t("settings.title" as any)}</h1>
      </header>

      <div className="space-y-8">

        {/* ── Account & Cloud Sync ── */}
        <section>
          <SectionLabel>{t("settings.cloudSync" as any)}</SectionLabel>
          <div className="card p-5 space-y-4">
            {/* Account info */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>
                  {(user.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                    {user.email}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {t("auth.loggedInAs" as any, { email: user.email || '' })}
                  </div>
                </div>
              </div>
            )}

            {/* Sync status */}
            <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'var(--surface-alt)' }}>
              {isOnline ? (
                <Cloud size={18} style={{ color: 'var(--success)' }} />
              ) : (
                <CloudOff size={18} style={{ color: 'var(--warning)' }} />
              )}
              <div className="flex-1">
                <div className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
                  {isOnline
                    ? t("settings.cloudSync.connected" as any)
                    : t("settings.cloudSync.offline" as any)}
                </div>
                {pendingOps > 0 && (
                  <div className="text-[11px]" style={{ color: 'var(--warning)' }}>
                    {t("settings.cloudSync.pending" as any, { count: String(pendingOps) })}
                  </div>
                )}
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-lg w-full justify-center transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--danger)' }}
            >
              <LogOut size={14} />
              {t("auth.logoutBtn" as any)}
            </button>
          </div>
        </section>

        {/* ── Profile ── */}
        <section>
          <SectionLabel>{t("settings.profile" as any)}</SectionLabel>
          <div className="card p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                {operatorAvatar
                  ? <img src={operatorAvatar} alt={operatorName.trim() || 'Andy'} className="h-full w-full object-cover" />
                  : ((operatorName.trim() || 'Andy').charAt(0).toUpperCase() || 'A')}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder={t("settings.namePlaceholder" as any)}
                  className="input-base w-full px-3 py-2 text-[13px]"
                />
                <div className="flex items-center gap-2 mt-2">
                  <label className="btn-ghost text-[11px] cursor-pointer px-2.5 py-1.5 rounded-md" style={{ border: '1px solid var(--border)' }}>
                    <Upload size={12} /> {t("settings.uploadAvatar" as any)}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  {operatorAvatar && (
                    <button type="button" onClick={clearAvatar} className="btn-ghost text-[11px] px-2.5 py-1.5 rounded-md" style={{ color: 'var(--danger)' }}>
                      <Trash2 size={12} /> {t("settings.removeAvatar" as any)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <SectionLabel>{t("settings.appearance" as any)}</SectionLabel>
          <div className="card overflow-hidden">
            {/* Dark mode toggle */}
            <button onClick={toggleDarkMode} className="list-item w-full flex items-center justify-between px-5 py-3.5 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                  {darkMode ? <Moon size={15} /> : <Sun size={15} />}
                </div>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{t("settings.darkMode" as any)}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{darkMode ? t("settings.darkModeOn" as any) : t("settings.darkModeOff" as any)}</div>
                </div>
              </div>
              <div className="relative w-10 h-6 rounded-full transition-colors" style={{ background: darkMode ? 'var(--accent)' : 'var(--border-strong)' }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform" style={{ left: darkMode ? '18px' : '2px' }} />
              </div>
            </button>

            {/* Language switcher */}
            <div className="list-item flex items-center justify-between px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                  <Globe size={15} />
                </div>
                <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{t("settings.language" as any)}</div>
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {([["zh", t("settings.langZh" as any)], ["en", t("settings.langEn" as any)]] as [Lang, string][]).map(([l, label]) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                    style={{
                      background: lang === l ? 'var(--accent)' : 'transparent',
                      color: lang === l ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── API Keys ── */}
        <section>
          <SectionLabel>{t("settings.apiKeys" as any)}</SectionLabel>
          <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {apiKeys.map((ak) => {
              const ts = testStates[ak.key];
              return (
                <div key={ak.key} className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{ak.label}</span>
                    {ak.badge && <span className="badge text-[10px]" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{ak.badge}</span>}
                    <div className="flex-1" />
                    <a href={ak.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--accent)' }}>
                      <ExternalLink size={10} /> {ak.linkLabel}
                    </a>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{ak.desc}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={ak.value}
                      onChange={(e) => ak.onChange(e.target.value)}
                      placeholder={ak.placeholder}
                      className="input-base flex-1 px-3 py-2 text-[13px]"
                    />
                    <button
                      onClick={() => handleTestKey(ak.key)}
                      disabled={ts.status === 'testing'}
                      className="btn-primary text-[11px] px-3 py-2 shrink-0 disabled:opacity-50"
                    >
                      {ts.status === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      {t("common.test" as any)}
                    </button>
                  </div>
                  {ts.status !== 'idle' && ts.status !== 'testing' && (
                    <StatusMsg status={ts.status} message={ts.message} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Image Model ── */}
        <section>
          <SectionLabel>{t("settings.imageGen" as any)}</SectionLabel>
          <div className="card p-4 space-y-3">
            <FL label={t("settings.imageGen.provider" as any)}>
              <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                <option value="google">{t("settings.imageGen.providerGoogle" as any)}</option>
                <option value="custom">{t("settings.imageGen.providerCustom" as any)}</option>
              </select>
            </FL>
            <FL label={t("settings.imageGen.model" as any)}>
              <input type="text" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="imagen-4.0-generate-001" className="input-base w-full px-3 py-2 text-[13px]" />
            </FL>
            <FL label={t("settings.imageGen.apiKey" as any)}>
              <input type="password" value={imageApiKey} onChange={(e) => setImageApiKey(e.target.value)} placeholder={t("settings.imageGen.apiKeyPlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
            </FL>
          </div>
        </section>

        {/* ── Save button ── */}
        <button onClick={handleSave} className="btn-primary text-[13px] w-full md:w-auto">
          <Save size={14} /> {t("settings.saveBtn" as any)}
        </button>

        {/* ── Version info ── */}
        <div className="text-center py-4 space-y-1">
          <div className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            一人CEO v{__APP_VERSION__}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {t("settings.version.checkUpdate" as any)}
          </div>
        </div>

        {/* Bottom spacer for mobile */}
        <div className="h-20 lg:h-8" />
      </div>
    </div>
  );
}
