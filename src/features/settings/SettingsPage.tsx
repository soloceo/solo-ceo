import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useT } from '../../i18n/context';
import { useAuth } from '../../auth/AuthProvider';
import { getQueueLength } from '../../db/offline-queue';
import { useUIStore } from '../../store/useUIStore';
import { useSettingsStore, PROFILE_SYNC_KEYS } from '../../store/useSettingsStore';

import { useAppSettings, invalidateSettingsCache } from '../../hooks/useAppSettings';
import { api } from '../../lib/api';
import ProfileSection from './ProfileSection';
import AppearanceSection from './AppearanceSection';
import PlanSection from './PlanSection';
import AccountSection from './AccountSection';
import SecuritySection from './SecuritySection';
import AISection from './AISection';
import AgentSection from './AgentSection';

function UpdateButton({ t, showToast }: { t: (k: string) => string; showToast: (msg: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'updating'>('idle');
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Clean up interval on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleCheck = useCallback(async () => {
    if (status !== 'idle') return;
    setStatus('checking');
    setProgress(0);

    // Animate progress: fast to 60%, then slow crawl
    if (timerRef.current) clearInterval(timerRef.current);
    let p = 0;
    timerRef.current = setInterval(() => {
      if (p < 60) p += 8;
      else if (p < 90) p += 1.5;
      else if (p < 95) p += 0.3;
      setProgress(Math.min(p, 95));
    }, 100);

    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        setProgress(100);
        clearInterval(timerRef.current); timerRef.current = undefined;
        await new Promise(r => setTimeout(r, 300));
        window.location.reload();
        return;
      }

      await reg.update();
      await new Promise(r => setTimeout(r, 1500));

      if (reg.waiting || reg.installing) {
        clearInterval(timerRef.current); timerRef.current = undefined;
        setStatus('updating');
        setProgress(100);
        await new Promise(r => setTimeout(r, 400));
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      } else {
        clearInterval(timerRef.current); timerRef.current = undefined;
        setProgress(100);
        await new Promise(r => setTimeout(r, 400));
        showToast(t("settings.version.upToDate"));
        setStatus('idle');
        setProgress(0);
      }
    } catch {
      clearInterval(timerRef.current); timerRef.current = undefined;
      setProgress(100);
      await new Promise(r => setTimeout(r, 300));
      window.location.reload();
    }
  }, [status, t, showToast]);

  const label = status === 'checking' ? t("settings.version.checking")
    : status === 'updating' ? t("settings.version.updating")
    : t("settings.version.forceUpdate");

  const isActive = status !== 'idle';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleCheck}
        disabled={isActive}
        className="btn-ghost compact text-[13px] px-3 rounded-[var(--radius-4)] mx-auto"
        style={{ color: isActive ? 'var(--color-text-tertiary)' : 'var(--color-accent)' }}
      >
        {label}
      </button>
      {isActive && (
        <div
          className="overflow-hidden rounded-full"
          style={{ width: 180, height: 3, background: 'var(--color-border-primary)' }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--color-accent)',
              borderRadius: 'inherit',
              transition: progress === 0 ? 'none' : 'width 0.15s ease-out',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useT();
  const { user, signOut } = useAuth();
  const showToast = useUIStore((s) => s.showToast);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const styleId = useUIStore((s) => s.styleId);
  const setStyleId = useUIStore((s) => s.setStyleId);
  const paletteId = useUIStore((s) => s.paletteId);
  const setPaletteId = useUIStore((s) => s.setPaletteId);

  const { settings: appSettings, save: saveAppSetting } = useAppSettings();
  const operatorName = useSettingsStore((s) => s.operatorName) || 'Andy';
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const setProfileField = useSettingsStore((s) => s.setProfileField);
  const businessTitle = useSettingsStore((s) => s.businessTitle);
  const businessName = useSettingsStore((s) => s.businessName);
  const businessDescription = useSettingsStore((s) => s.businessDescription);
  const businessEmail = useSettingsStore((s) => s.businessEmail);
  const businessPhone = useSettingsStore((s) => s.businessPhone);
  const businessWebsite = useSettingsStore((s) => s.businessWebsite);
  const businessLocation = useSettingsStore((s) => s.businessLocation);
  const personalPreferences = useSettingsStore((s) => s.personalPreferences);
  const profileFieldValues: Record<string, string> = { businessTitle, businessName, businessDescription, businessEmail, businessPhone, businessWebsite, businessLocation, personalPreferences };
  const getProfileField = (field: string) => profileFieldValues[field] || '';
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
    // Build payload from all profile sync keys
    const payload: Record<string, string> = {};
    const store = useSettingsStore.getState();
    for (const [field, key] of Object.entries(PROFILE_SYNC_KEYS)) {
      payload[key] = (store[field as keyof typeof PROFILE_SYNC_KEYS] as string) || '';
    }
    payload.OPERATOR_NAME = cleanedName;
    payload.OPERATOR_AVATAR = operatorAvatar || '';
    api.post('/api/settings', payload).then(() => invalidateSettingsCache()).catch(() => {});
    showToast(t("settings.saved"));
  };

  /* ── Avatar ── */
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

  const compressAndSaveAvatar = (dataUrl: string) => {
    const img = new Image();
    const onLoaded = () => {
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
        .then(() => invalidateSettingsCache())
        .catch(() => { /* avatar save failed */ });
      showToast(t("settings.avatarUpdated"));
    };
    img.onerror = () => showToast(t("settings.avatarInvalid"));
    img.src = dataUrl;
    if (img.complete) onLoaded();
    else img.onload = onLoaded;
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
      .then(() => invalidateSettingsCache())
      .catch(() => { /* avatar remove failed */ });
    showToast(t("settings.avatarRemoved"));
  };

  /* ── Render ── */
  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:px-6 md:pb-6 md:pt-0 lg:px-8 lg:pb-8 lg:pt-0 relative">

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
          savePreferences={(value) => {
            saveAppSetting('PERSONAL_PREFERENCES', value).catch(() => { /* queued offline */ });
          }}
          getField={getProfileField}
          setField={(field, value) => setProfileField(field as keyof typeof PROFILE_SYNC_KEYS, value)}
        />

        {/* 2. Appearance — theme, language, currency */}
        <AppearanceSection
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          styleId={styleId}
          setStyleId={setStyleId}
          paletteId={paletteId}
          setPaletteId={setPaletteId}
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

        {/* 5.5 Custom AI Agents */}
        <AgentSection />

        {/* 6. Account Security — rarely used, at bottom */}
        <SecuritySection />

        {/* Version info */}
        <div className="text-center py-4 space-y-2">
          <div className="text-[15px]" style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
            {t("auth.title")} v{__APP_VERSION__}
          </div>
          <UpdateButton t={t} showToast={showToast} />
        </div>

        {/* Bottom spacer for mobile */}
        <div className="h-20 lg:h-8" />
      </div>
    </div>
  );
}
