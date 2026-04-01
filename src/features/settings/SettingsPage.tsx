import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useAuth } from '../../auth/AuthProvider';
import { getQueueLength } from '../../db/offline-queue';
import { useUIStore } from '../../store/useUIStore';
import { useSettingsStore } from '../../store/useSettingsStore';

import { useAppSettings } from '../../hooks/useAppSettings';
import { api } from '../../lib/api';
import ProfileSection from './ProfileSection';
import AppearanceSection from './AppearanceSection';
import PlanSection from './PlanSection';
import AccountSection from './AccountSection';
import SecuritySection from './SecuritySection';
import AISection from './AISection';

export default function SettingsPage() {
  const { t, lang, setLang } = useT();
  const { user, signOut } = useAuth();
  const showToast = useUIStore((s) => s.showToast);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const { settings: appSettings, save: saveAppSetting } = useAppSettings();
  const operatorName = useSettingsStore((s) => s.operatorName) || 'Andy';
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const currency = useSettingsStore((s) => s.currency);
  const timezone = useSettingsStore((s) => s.timezone);
  const isOnline = useSettingsStore((s) => s.isOnline);
  const pendingOps = useSettingsStore((s) => s.pendingOps);
  const setOperator = useSettingsStore((s) => s.setOperator);
  const setCurrencyLocal = useSettingsStore((s) => s.setCurrency);
  const setTimezoneLocal = useSettingsStore((s) => s.setTimezone);
  const setOnline = useSettingsStore((s) => s.setOnline);
  const setPendingOps = useSettingsStore((s) => s.setPendingOps);

  // Wrap setCurrency / setTimezone to also persist to Supabase
  const setCurrency = (v: string) => {
    setCurrencyLocal(v);
    saveAppSetting('CURRENCY', v);
  };
  const setTimezone = (v: string) => {
    setTimezoneLocal(v);
    saveAppSetting('TIMEZONE', v);
  };

  useEffect(() => {
    getQueueLength().then(setPendingOps).catch(() => { /* offline — no queue available */ });
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
    api.post('/api/settings', { OPERATOR_NAME: cleanedName, OPERATOR_AVATAR: operatorAvatar || '' })
      .catch(() => { /* save failed — toast already shown */ });
    showToast(t("settings.saved"));
  };

  /* ── Avatar ── */
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

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
      api.post('/api/settings', { OPERATOR_AVATAR: compressed })
        .catch(() => { /* avatar save failed */ });
      showToast(t("settings.avatarUpdated"));
    };
    img.src = dataUrl;
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t("settings.avatarInvalid")); return; }
    if (file.size > MAX_AVATAR_SIZE) { showToast(t("settings.avatarTooLarge")); return; }
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
    api.post('/api/settings', { OPERATOR_AVATAR: '' })
      .catch(() => { /* avatar remove failed */ });
    showToast(t("settings.avatarRemoved"));
  };

  /* ── Render ── */
  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:p-6 lg:p-8 relative">

      <h1 className="sr-only">{t("settings.title")}</h1>

      <div className="space-y-6 md:space-y-8">

        {/* 1. Profile — most personal, top position */}
        <ProfileSection
          operatorName={operatorName}
          setOperatorName={(name) => setOperator(name)}
          operatorAvatar={operatorAvatar}
          handleAvatarUpload={handleAvatarUpload}
          clearAvatar={clearAvatar}
          handleSave={handleSave}
        />

        {/* 2. Appearance — theme, language, currency */}
        <AppearanceSection
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          lang={lang}
          setLang={setLang}
          currency={currency}
          setCurrency={setCurrency}
          timezone={timezone}
          setTimezone={setTimezone}
        />

        {/* 3. Plan Manager — business config */}
        <PlanSection showToast={showToast} />

        {/* 4. Account & Cloud Sync */}
        <AccountSection user={user} isOnline={isOnline} pendingOps={pendingOps} signOut={signOut} />

        {/* 5. AI Assistant */}
        <AISection settings={appSettings} save={saveAppSetting} />

        {/* 6. Account Security — rarely used, at bottom */}
        <SecuritySection showToast={showToast} />

        {/* Version info */}
        <div className="text-center py-4 space-y-2">
          <div className="text-[15px]" style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
            {t("auth.title")} v{__APP_VERSION__}
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
            className="btn-ghost compact text-[13px] px-3 rounded-[var(--radius-4)] mx-auto"
            style={{ color: 'var(--color-accent)' }}
          >
            {t("settings.version.forceUpdate")}
          </button>
        </div>

        {/* Bottom spacer for mobile */}
        <div className="h-20 lg:h-8" />
      </div>
    </div>
  );
}
