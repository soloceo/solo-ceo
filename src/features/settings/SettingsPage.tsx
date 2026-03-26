import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useAuth } from '../../auth/AuthProvider';
import { getQueueLength } from '../../db/offline-queue';
import { useUIStore } from '../../store/useUIStore';
import { useSettingsStore } from '../../store/useSettingsStore';

import AccountSection from './AccountSection';
import SecuritySection from './SecuritySection';
import PlanSection from './PlanSection';
import ProfileSection from './ProfileSection';
import AppearanceSection from './AppearanceSection';

export default function SettingsPage() {
  const { t, lang, setLang } = useT();
  const { user, signOut } = useAuth();
  const showToast = useUIStore((s) => s.showToast);
  const darkMode = useUIStore((s) => s.darkMode);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);

  const operatorName = useSettingsStore((s) => s.operatorName) || 'Andy';
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const currency = useSettingsStore((s) => s.currency);
  const timezone = useSettingsStore((s) => s.timezone);
  const isOnline = useSettingsStore((s) => s.isOnline);
  const pendingOps = useSettingsStore((s) => s.pendingOps);
  const setOperator = useSettingsStore((s) => s.setOperator);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const setTimezone = useSettingsStore((s) => s.setTimezone);
  const setOnline = useSettingsStore((s) => s.setOnline);
  const setPendingOps = useSettingsStore((s) => s.setPendingOps);

  useEffect(() => {
    // Check pending offline ops
    getQueueLength().then(setPendingOps).catch(() => {});

    // Listen for online/offline events
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
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
  }, [setOnline, setPendingOps]);

  /* ── Save ── */
  const handleSave = () => {
    const cleanedName = operatorName.trim() || 'Andy';
    setOperator(cleanedName, operatorAvatar || '');
    window.dispatchEvent(new Event('operator-name-updated'));
    window.dispatchEvent(new Event('operator-avatar-updated'));
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OPERATOR_NAME: cleanedName, OPERATOR_AVATAR: operatorAvatar || '' }),
    }).catch(() => {});
    showToast(t("settings.saved" as any));
  };

  /* ── Avatar ── */
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

  const compressAndSaveAvatar = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 128;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width - srcSize) / 2;
      const sy = (img.height - srcSize) / 2;
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      setOperator(operatorName, compressed);
      window.dispatchEvent(new Event('operator-avatar-updated'));
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ OPERATOR_AVATAR: compressed }),
      }).catch(() => {});
      showToast(t("settings.avatarUpdated" as any));
    };
    img.src = dataUrl;
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t("settings.avatarInvalid" as any)); return; }
    if (file.size > MAX_AVATAR_SIZE) { showToast(t("settings.avatarTooLarge" as any)); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      compressAndSaveAvatar(result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clearAvatar = () => {
    setOperator(operatorName, '');
    window.dispatchEvent(new Event('operator-avatar-updated'));
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OPERATOR_AVATAR: '' }),
    }).catch(() => {});
    showToast(t("settings.avatarRemoved" as any));
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="mobile-page max-w-2xl lg:max-w-3xl mx-auto px-4 py-4 md:px-8 md:py-6 lg:py-8 relative">

      {/* Header */}
      <header className="mb-6">
        <h1 className="page-title">{t("settings.title" as any)}</h1>
      </header>

      <div className="space-y-8">

        {/* ── Account & Cloud Sync ── */}
        <AccountSection user={user} isOnline={isOnline} pendingOps={pendingOps} signOut={signOut} />

        {/* ── Account Security ── */}
        <SecuritySection showToast={showToast} />

        {/* ── Plan Manager ── */}
        <PlanSection showToast={showToast} />

        {/* ── Profile ── */}
        <ProfileSection
          operatorName={operatorName}
          setOperatorName={(name) => setOperator(name)}
          operatorAvatar={operatorAvatar}
          handleAvatarUpload={handleAvatarUpload}
          clearAvatar={clearAvatar}
        />

        {/* ── Appearance ── */}
        <AppearanceSection
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          lang={lang}
          setLang={setLang}
          currency={currency}
          setCurrency={setCurrency}
          timezone={timezone}
          setTimezone={setTimezone}
        />

        {/* ── Save button ── */}
        <button onClick={handleSave} className="btn-primary text-[13px] w-full md:w-auto">
          <Save size={16} /> {t("settings.saveBtn" as any)}
        </button>

        {/* ── Version info ── */}
        <div className="text-center py-4 space-y-2">
          <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
            {t("auth.title" as any)} v{__APP_VERSION__}
          </div>
          <button
            onClick={async () => {
              if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                  await reg.update();
                  if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
                }
              }
              window.location.reload();
            }}
            className="btn-ghost text-[11px] px-3 py-1.5 rounded-[var(--radius-4)] mx-auto"
            style={{ color: 'var(--color-accent)' }}
          >
            {t("settings.version.forceUpdate" as any)}
          </button>
        </div>

        {/* Bottom spacer for mobile */}
        <div className="h-20 lg:h-8" />
      </div>
    </div>
  );
}
