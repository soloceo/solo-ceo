import React, { useState } from 'react';
import { Camera, Trash2, Save, User, Upload, Check } from 'lucide-react';
import { useT } from '../../i18n/context';

interface ProfileSectionProps {
  operatorName: string;
  setOperatorName: (name: string) => void;
  operatorAvatar: string;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearAvatar: () => void;
  handleSave: () => void;
  getField: (field: string) => string;
  setField: (field: string, value: string) => void;
}

function SaveButton({ handleSave, label }: { handleSave: () => void; label: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => {
        handleSave();
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
      className="btn-primary text-[15px] w-full"
      style={saved ? { background: 'var(--color-success)', transition: 'background 0.2s ease' } : { transition: 'background 0.2s ease' }}
    >
      {saved ? <Check size={16} /> : <Save size={16} />}
      {' '}{saved ? '✓' : label}
    </button>
  );
}

export default function ProfileSection({
  operatorName, setOperatorName, operatorAvatar,
  handleAvatarUpload, clearAvatar, handleSave,
  getField, setField,
}: ProfileSectionProps) {
  const { t } = useT();

  return (
    <section>
      <div className="card p-5 space-y-5">
        {/* Row 1: Avatar + Name */}
        <div className="flex items-center gap-4">
          {/* Avatar with camera overlay */}
          <label className="relative shrink-0 cursor-pointer group" title={t("settings.uploadAvatar")}>
            <div
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-base"
              style={{
                background: operatorAvatar ? 'transparent' : 'var(--color-accent-tint)',
                color: 'var(--color-accent)',
                fontWeight: 'var(--font-weight-bold)',
              } as React.CSSProperties}
            >
              {operatorAvatar
                ? <img src={operatorAvatar} alt={operatorName.trim() || 'Andy'} className="h-full w-full object-cover" />
                : <User size={20} />
              }
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent)', color: 'var(--color-brand-text)' }}
            >
              <Camera size={10} />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
          <input
            type="text"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder={t("settings.namePlaceholder")}
            className="input-base flex-1 px-3 py-2 text-[15px]"
            style={{ fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}
          />
          {operatorAvatar && (
            <button type="button" onClick={clearAvatar} className="btn-ghost compact shrink-0" style={{ color: 'var(--color-danger)' }} title={t("settings.deleteAvatar") || "Delete"}>
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Title & Company */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessTitle")}</span>
          <input
            type="text"
            value={getField('businessTitle')}
            onChange={(e) => setField('businessTitle', e.target.value)}
            placeholder={t("settings.businessTitlePlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessName")}</span>
          <input
            type="text"
            value={getField('businessName')}
            onChange={(e) => setField('businessName', e.target.value)}
            placeholder={t("settings.businessNamePlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessDescription")}</span>
          <textarea
            value={getField('businessDescription')}
            onChange={(e) => setField('businessDescription', e.target.value)}
            placeholder={t("settings.businessDescPlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px] resize-none"
            rows={2}
            maxLength={200}
          />
          <span className="text-[12px]" style={{ color: 'var(--color-text-quaternary)' }}>
            {t("settings.businessDescHint")}
          </span>
        </label>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--color-line-secondary)' }} />

        {/* Contact fields */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessEmail")}</span>
          <input
            type="email"
            value={getField('businessEmail')}
            onChange={(e) => setField('businessEmail', e.target.value)}
            placeholder={t("settings.businessEmailPlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessPhone")}</span>
          <input
            type="tel"
            value={getField('businessPhone')}
            onChange={(e) => setField('businessPhone', e.target.value)}
            placeholder={t("settings.businessPhonePlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessWebsite")}</span>
          <input
            type="url"
            value={getField('businessWebsite')}
            onChange={(e) => setField('businessWebsite', e.target.value)}
            placeholder={t("settings.businessWebsitePlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{t("settings.businessLocation")}</span>
          <input
            type="text"
            value={getField('businessLocation')}
            onChange={(e) => setField('businessLocation', e.target.value)}
            placeholder={t("settings.businessLocationPlaceholder")}
            className="input-base w-full px-3 py-2 text-[15px]"
          />
        </label>

        {/* Save */}
        <SaveButton handleSave={handleSave} label={t("settings.saveBtn")} />

      </div>
    </section>
  );
}
