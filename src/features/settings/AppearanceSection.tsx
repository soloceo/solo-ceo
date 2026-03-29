import React from 'react';
import { Moon, Sun, Monitor, Globe, DollarSign, Clock } from 'lucide-react';
import { useT, type Lang } from '../../i18n/context';

type ThemeMode = 'light' | 'dark' | 'auto';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface AppearanceSectionProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
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

export default function AppearanceSection({ themeMode, setThemeMode, lang, setLang, currency, setCurrency, timezone, setTimezone }: AppearanceSectionProps) {
  const { t } = useT();

  return (
    <section>
      <SectionLabel>{t("settings.appearance" as any)}</SectionLabel>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">

        {/* Theme mode — 3-way segmented control */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              {themeMode === 'dark' ? <Moon size={20} /> : themeMode === 'auto' ? <Monitor size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.colorMode" as any)}</div>
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {themeMode === 'auto'
                  ? t("settings.themeAutoDesc" as any)
                  : themeMode === 'dark'
                  ? t("settings.darkModeOn" as any)
                  : t("settings.darkModeOff" as any)}
              </div>
            </div>
          </div>
          <div className="flex rounded-[var(--radius-6)] overflow-hidden" style={{ border: '1px solid var(--color-border-primary)' }}>
            {themeModes.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setThemeMode(value)}
                className="px-3 py-2 cursor-pointer transition-colors flex items-center gap-1.5"
                style={{
                  background: themeMode === value ? 'var(--color-accent)' : 'transparent',
                  color: themeMode === value ? 'var(--color-text-on-color)' : 'var(--color-text-tertiary)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize: '13px',
                } as React.CSSProperties}
                aria-label={value}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}` as any)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-blue) 10%, transparent)', color: 'var(--color-blue)' }}>
              <Globe size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.language" as any)}</div>
          </div>
          <div className="flex rounded-[var(--radius-6)] overflow-hidden" style={{ border: '1px solid var(--color-border-primary)' }}>
            {([["zh", "中文"], ["en", "EN"]] as [Lang, string][]).map(([l, label]) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="px-3.5 py-2 text-[14px] cursor-pointer transition-colors"
                style={{
                  background: lang === l ? 'var(--color-accent)' : 'transparent',
                  color: lang === l ? 'var(--color-text-on-color)' : 'var(--color-text-tertiary)',
                  fontWeight: 'var(--font-weight-medium)',
                } as React.CSSProperties}
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
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.currency" as any)}</div>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-base px-3 py-2 text-[15px]">
            {[['USD', '$ USD'], ['CNY', '¥ CNY'], ['EUR', '€ EUR'], ['GBP', '£ GBP'], ['JPY', '¥ JPY'], ['CAD', '$ CAD'], ['AUD', '$ AUD'], ['HKD', '$ HKD'], ['TWD', '$ TWD'], ['SGD', '$ SGD']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-orange) 10%, transparent)', color: 'var(--color-orange)' }}>
              <Clock size={20} />
            </div>
            <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.timezone" as any)}</div>
          </div>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-base px-3 py-2 text-[15px] min-w-0 max-w-[200px]">
            {['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Australia/Sydney', 'Pacific/Auckland'].map(tz => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
