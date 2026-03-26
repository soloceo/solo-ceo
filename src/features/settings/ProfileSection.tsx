import React from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useT } from '../../i18n/context';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="section-label mb-3">{children}</h3>;
}

interface ProfileSectionProps {
  operatorName: string;
  setOperatorName: (name: string) => void;
  operatorAvatar: string;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearAvatar: () => void;
}

export default function ProfileSection({ operatorName, setOperatorName, operatorAvatar, handleAvatarUpload, clearAvatar }: ProfileSectionProps) {
  const { t } = useT();

  return (
    <section>
      <SectionLabel>{t("settings.profile" as any)}</SectionLabel>
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-12)] text-lg" style={{ background: 'var(--color-accent-tint)', color: 'var(--color-accent)', fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
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
              <label className="btn-ghost text-[11px] cursor-pointer px-3 py-2 rounded-[var(--radius-4)]" style={{ border: '1px solid var(--color-border-primary)' }}>
                <Upload size={16} /> {t("settings.uploadAvatar" as any)}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              {operatorAvatar && (
                <button type="button" onClick={clearAvatar} className="btn-ghost text-[11px] px-3 py-2 rounded-[var(--radius-4)]" style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={16} /> {t("settings.removeAvatar" as any)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
