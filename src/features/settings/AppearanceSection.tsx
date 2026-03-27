import React from 'react';
import { Moon, Sun, Globe, DollarSign, Clock } from 'lucide-react';
import { useT, type Lang } from '../../i18n/context';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface AppearanceSectionProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
}

export default function AppearanceSection({ darkMode, toggleDarkMode, lang, setLang, currency, setCurrency, timezone, setTimezone }: AppearanceSectionProps) {
  const { t } = useT();

  return (
    <section>
      <SectionLabel>{t("settings.appearance" as any)}</SectionLabel>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">

        {/* Dark mode toggle */}
        <button onClick={toggleDarkMode} className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-tertiary)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-8)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              {darkMode ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <div className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.darkMode" as any)}</div>
              <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{darkMode ? t("settings.darkModeOn" as any) : t("settings.darkModeOff" as any)}</div>
            </div>
          </div>
          <div className="relative w-11 h-[26px] rounded-full transition-colors shrink-0" style={{ background: darkMode ? 'var(--color-accent)' : 'var(--color-bg-quaternary)' }}>
            <div className="absolute top-[3px] w-5 h-5 rounded-full bg-[var(--color-bg-primary)] transition-transform" style={{ left: darkMode ? '22px' : '3px', boxShadow: 'var(--shadow-tiny)' }} />
          </div>
        </button>

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
                className="px-3.5 py-2 text-[14px] transition-colors"
                style={{
                  background: lang === l ? 'var(--color-accent)' : 'transparent',
                  color: lang === l ? 'var(--color-brand-text)' : 'var(--color-text-tertiary)',
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
