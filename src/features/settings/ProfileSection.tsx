import React from 'react';
import { Upload, Trash2, Camera, Save, User } from 'lucide-react';
import { useT } from '../../i18n/context';

interface ProfileSectionProps {
  operatorName: string;
  setOperatorName: (name: string) => void;
  operatorAvatar: string;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearAvatar: () => void;
  handleSave: () => void;
}

export default function ProfileSection({ operatorName, setOperatorName, operatorAvatar, handleAvatarUpload, clearAvatar, handleSave }: ProfileSectionProps) {
  const { t } = useT();

  return (
    <section>
      <div className="card overflow-hidden">
        {/* Avatar hero area */}
        <div
          className="flex flex-col items-center pt-8 pb-6 px-5"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 6%, transparent) 0%, transparent 100%)' }}
        >
          {/* Avatar with camera overlay */}
          <div className="relative group mb-3">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl ring-4"
              style={{
                background: operatorAvatar ? 'transparent' : 'var(--color-accent-tint)',
                color: 'var(--color-accent)',
                fontWeight: 'var(--font-weight-bold)',
                ringColor: 'var(--color-bg-primary)',
              } as React.CSSProperties}
            >
              {operatorAvatar
                ? <img src={operatorAvatar} alt={operatorName.trim() || 'Andy'} className="h-full w-full object-cover" />
                : <User size={32} />
              }
            </div>
            {/* Camera overlay */}
            <label className="absolute inset-0 flex items-center justify-center rounded-full cursor-pointer" style={{ background: 'var(--color-overlay-primary)' }}>
              <Camera size={20} style={{ color: 'var(--color-text-primary)' }} />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>

          {/* Name display */}
          <div className="text-[15px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
            {operatorName.trim() || 'Andy'}
          </div>
          <div className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>Solo CEO</div>
        </div>

        {/* Edit fields */}
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid var(--color-line-secondary)' }}>
          {/* Name input */}
          <label className="flex flex-col gap-1.5 pt-4">
            <span className="section-label">{t("settings.profile")}</span>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder={t("settings.namePlaceholder")}
              className="input-base w-full px-3 py-2 text-[15px]"
            />
          </label>

          {/* Avatar actions */}
          <div className="flex items-center gap-2">
            <label className="btn-secondary text-[15px] flex-1 cursor-pointer">
              <Upload size={14} /> {t("settings.uploadAvatar")}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
            {operatorAvatar && (
              <button type="button" onClick={clearAvatar} className="btn-secondary text-[15px]" style={{ color: 'var(--color-danger)' }}>
                <Trash2 size={14} /> {t("settings.removeAvatar")}
              </button>
            )}
          </div>

          {/* Save button */}
          <button onClick={handleSave} className="btn-primary text-[15px] w-full">
            <Save size={16} /> {t("settings.saveBtn")}
          </button>
        </div>
      </div>
    </section>
  );
}
