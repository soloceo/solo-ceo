import React, { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Monitor, Globe, DollarSign, Clock, RefreshCw, Check, AlertCircle, ChevronDown, Palette, Layers } from 'lucide-react';
import { useT, type Lang } from '../../i18n/context';
import { api } from '../../lib/api';
import { palettes, styles } from '../../themes';

type ThemeMode = 'light' | 'dark' | 'auto';
type SyncState = 'idle' | 'checking' | 'ok' | 'offset' | 'error';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface AppearanceSectionProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  styleId: string;
  setStyleId: (id: string) => void;
  paletteId: string;
  setPaletteId: (id: string) => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
}

const themeModes: { value: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'settings.themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'settings.themeDark' },
  { value: 'auto', icon: Monitor, labelKey: 'settings.themeAuto' },
];


export default function AppearanceSection({ themeMode, setThemeMode, styleId, setStyleId, paletteId, setPaletteId, lang, setLang, currency, setCurrency, timezone, setTimezone }: AppearanceSectionProps) {
  const { t } = useT();

  // ── Live clock ──
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formattedTime = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  // ── Time sync check ──
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [offsetSec, setOffsetSec] = useState(0);

  const checkTimeSync = useCallback(async () => {
    setSyncState('checking');
    try {
      const before = Date.now();
      const json = await api.get<{ unixMs?: number; data?: { unixMs?: number } }>('/api/server-time');
      const after = Date.now();
      const serverUnix = json?.unixMs ?? json?.data?.unixMs;
      const roundTrip = after - before;
      const localNow = before + roundTrip / 2;
      const diff = Math.abs(localNow - serverUnix) / 1000;
      setOffsetSec(Math.round(diff));
      setSyncState(diff < 3 ? 'ok' : 'offset');
    } catch (e) {
      console.warn('[AppearanceSection] checkTimeDrift', e);
      setSyncState('error');
    }
  }, []);

  // Auto-detect timezone on mount (only if not already set by user)
  const detectedTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
  const isAutoDetected = timezone === detectedTz;

  const [showTzPicker, setShowTzPicker] = useState(false);

  return (
    <section>
      <SectionLabel>{t("settings.appearance")}</SectionLabel>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">

        {/* Theme mode — 3-way segmented control */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              {themeMode === 'dark' ? <Moon size={20} /> : themeMode === 'auto' ? <Monitor size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.colorMode")}</div>
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {themeMode === 'auto'
                  ? t("settings.themeAutoDesc")
                  : themeMode === 'dark'
                  ? t("settings.darkModeOn")
                  : t("settings.darkModeOff")}
              </div>
            </div>
          </div>
          <div className="btn-group-inline">
            {themeModes.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setThemeMode(value)}
                data-active={themeMode === value}
                aria-label={value}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Style + Palette — combined picker */}
        <div className="px-4 py-4">
          {/* Style picker — full-width cards */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', color: 'var(--color-purple)' }}>
              <Layers size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.style")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {styles.map((s) => {
              const isActive = styleId === s.id;
              const isNeo = s.id === 'neobrutalism';
              const isGlass = s.id === 'glassmorphism';
              return (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className="relative rounded-[var(--radius-12)] p-3 text-left transition-all"
                  style={{
                    background: isActive ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-secondary))' : 'var(--color-bg-secondary)',
                    border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border-primary)',
                  }}
                >
                  {/* Preview area */}
                  <div
                    className="relative w-full h-14 mb-2.5 overflow-hidden"
                    style={{
                      background: isGlass
                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-primary)), var(--color-bg-primary))'
                        : 'var(--color-bg-primary)',
                      border: isNeo ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                      borderRadius: isNeo ? '3px' : isGlass ? '12px' : '8px',
                      boxShadow: isNeo
                        ? '3px 3px 0 var(--color-text-primary)'
                        : isGlass
                        ? '0 4px 16px rgba(0,0,0,0.06)'
                        : '0 1px 4px rgba(0,0,0,0.06)',
                      backdropFilter: isGlass ? 'blur(8px)' : undefined,
                    }}
                  >
                    {isGlass && (
                      <div className="absolute inset-0 rounded-[11px]" style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 60%)',
                        pointerEvents: 'none',
                      }} />
                    )}
                    <div
                      className="absolute top-2 left-2.5 right-2.5"
                      style={{ height: 5, background: 'var(--color-accent)', borderRadius: isNeo ? '1px' : '3px', opacity: isGlass ? 0.8 : 1 }}
                    />
                    <div className="absolute bottom-2 left-2.5 flex flex-col gap-1">
                      <div style={{ width: 32, height: 3, background: 'var(--color-text-primary)', opacity: 0.5, borderRadius: isNeo ? 0 : 2 }} />
                      <div style={{ width: 22, height: 3, background: 'var(--color-text-primary)', opacity: 0.25, borderRadius: isNeo ? 0 : 2 }} />
                    </div>
                  </div>
                  {/* Label */}
                  <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
                    {t(s.nameKey)}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t(s.descKey)}
                  </div>
                  {/* Check indicator */}
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                      <Check size={12} color="var(--color-brand-text)" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Palette picker — grid */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              <Palette size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.palette")}</div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {palettes.map((p) => {
              const isActive = paletteId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPaletteId(p.id)}
                  className="relative flex items-center gap-2.5 rounded-[var(--radius-10)] px-3 py-2.5 transition-all text-left"
                  style={{
                    background: isActive ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-secondary))' : 'var(--color-bg-secondary)',
                    border: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                  }}
                >
                  {/* Color dot */}
                  <div
                    className="w-5 h-5 rounded-full shrink-0"
                    style={{
                      background: p.preview.accent,
                      boxShadow: `0 0 0 2px ${p.preview.bg}, 0 0 0 3px ${p.preview.accent}40`,
                    }}
                  />
                  {/* Name */}
                  <div className="text-[12px] leading-tight truncate" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: isActive ? 600 : 400 }}>
                    {t(p.nameKey)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-blue) 10%, transparent)', color: 'var(--color-blue)' }}>
              <Globe size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.language")}</div>
          </div>
          <div className="btn-group-inline">
            {([["zh", "中文"], ["en", "EN"]] as [Lang, string][]).map(([l, label]) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                data-active={lang === l}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)' }}>
              <DollarSign size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.currency")}</div>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-base px-3 py-2 text-[15px]">
            {[['USD', '$ USD'], ['CNY', '¥ CNY'], ['EUR', '€ EUR'], ['GBP', '£ GBP'], ['JPY', '¥ JPY'], ['CAD', '$ CAD'], ['AUD', '$ AUD'], ['HKD', '$ HKD'], ['TWD', '$ TWD'], ['SGD', '$ SGD']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Timezone + Live Clock */}
        <div className="px-4 py-3">
          {/* Row 1: icon + label + live time + sync button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-orange) 10%, transparent)', color: 'var(--color-orange)' }}>
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                  {t("settings.timezone")}
                </div>
                <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {timezone.replace(/_/g, ' ')}{isAutoDetected ? (lang === 'zh' ? '（自动）' : ' (auto)') : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[15px] tabular-nums" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {formattedTime}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {syncState === 'ok' && (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--color-success)' }}>
                    <Check size={11} /> {t("settings.timeSynced")}
                  </span>
                )}
                {syncState === 'offset' && (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--color-warning)' }}>
                    <AlertCircle size={11} /> {(t("settings.timeOffset") as string).replace('{n}', String(offsetSec))}
                  </span>
                )}
                {syncState === 'error' && (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--color-error)' }}>
                    <AlertCircle size={11} /> {t("settings.timeSyncFail")}
                  </span>
                )}
                <button
                  onClick={checkTimeSync}
                  disabled={syncState === 'checking'}
                  className="btn-ghost compact px-1.5 py-0.5 rounded-[var(--radius-4)] text-[12px] flex items-center gap-1"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <RefreshCw size={11} className={syncState === 'checking' ? 'animate-spin' : ''} />
                  {t("settings.timeSyncCheck")}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: collapsible manual timezone picker */}
          <div className="ml-12 mt-2">
            <button
              onClick={() => setShowTzPicker(!showTzPicker)}
              className="btn-ghost compact px-0 py-0.5 text-[12px] flex items-center gap-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <ChevronDown size={12} className={'transition-transform ' + (showTzPicker ? 'rotate-180' : '')} />
              {lang === 'zh' ? '手动选择时区' : 'Change timezone'}
            </button>
            {showTzPicker && (
              <div className="mt-1.5 flex items-center gap-2">
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-base px-3 py-2 text-[14px] min-w-0 flex-1">
                  {['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Australia/Sydney', 'Pacific/Auckland'].map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                {!isAutoDetected && (
                  <button
                    onClick={() => { if (detectedTz) setTimezone(detectedTz); }}
                    className="btn-ghost compact px-2 py-2 rounded-[var(--radius-6)] text-[12px] whitespace-nowrap"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {t("settings.detectTimezone")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
