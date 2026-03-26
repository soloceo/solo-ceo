import React from 'react';
import { Moon, Sun, Globe } from 'lucide-react';
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
      <div className="card overflow-hidden">
        {/* Dark mode toggle */}
        <button onClick={toggleDarkMode} className="list-item w-full flex items-center justify-between px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            <div>
              <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.darkMode" as any)}</div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{darkMode ? t("settings.darkModeOn" as any) : t("settings.darkModeOff" as any)}</div>
            </div>
          </div>
          <div className="relative w-10 h-6 rounded-full transition-colors" style={{ background: darkMode ? 'var(--color-accent)' : 'var(--border-strong)' }}>
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform" style={{ left: darkMode ? '18px' : '2px' }} />
          </div>
        </button>

        {/* Language switcher */}
        <div className="list-item flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>
              <Globe size={16} />
            </div>
            <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.language" as any)}</div>
          </div>
          <div className="flex rounded-[var(--radius-6)] overflow-hidden" style={{ border: '1px solid var(--color-border-primary)' }}>
            {([["zh", t("settings.langZh" as any)], ["en", t("settings.langEn" as any)]] as [Lang, string][]).map(([l, label]) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="px-3 py-2 text-[13px] transition-colors"
                style={{
                  background: lang === l ? 'var(--color-accent)' : 'transparent',
                  color: lang === l ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: 'var(--font-weight-medium)',
                } as React.CSSProperties}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="list-item flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)] text-[13px]" style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)', fontWeight: 'var(--font-weight-bold)' } as React.CSSProperties}>$</div>
            <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.currency" as any)}</div>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-base px-2 py-2 text-[13px]">
            {[['USD', '$ USD'], ['CNY', '¥ CNY'], ['EUR', '€ EUR'], ['GBP', '£ GBP'], ['JPY', '¥ JPY'], ['CAD', '$ CAD'], ['AUD', '$ AUD'], ['HKD', '$ HKD'], ['TWD', '$ TWD'], ['SGD', '$ SGD']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div className="list-item flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>🌐</div>
            <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>{t("settings.timezone" as any)}</div>
          </div>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-base px-2 py-2 text-[13px] w-full md:max-w-[200px]">
            {['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Australia/Sydney', 'Pacific/Auckland'].map(tz => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
