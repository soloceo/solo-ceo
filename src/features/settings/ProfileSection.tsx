import React, { useState, useEffect, useRef } from 'react';
import { Camera, Trash2, Save, User, Upload, Check, Download, FileText, Sparkles } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useUIStore } from '../../store/useUIStore';

interface ProfileSectionProps {
  operatorName: string;
  setOperatorName: (name: string) => void;
  operatorAvatar: string;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearAvatar: () => void;
  handleSave: () => void;
  savePreferences: (value: string) => void;
  getField: (field: string) => string;
  setField: (field: string, value: string) => void;
}

function SaveButton({ handleSave, label }: { handleSave: () => void; label: string }) {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return (
    <button
      onClick={() => {
        handleSave();
        setSaved(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setSaved(false), 1500);
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
  handleAvatarUpload, clearAvatar, handleSave, savePreferences,
  getField, setField,
}: ProfileSectionProps) {
  const { t } = useT();

  return (
    <section>
      <div className="card p-4 space-y-4">
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

      {/* Personal Preferences */}
      <PreferencesBlock getField={getField} setField={setField} savePreferences={savePreferences} />
    </section>
  );
}

/* ── Preference template (concise, 3 sections) ── */
const PREF_TEMPLATE_ZH = `# 个人偏好

## 沟通风格
- 简洁直接，用中文回复
- 先给结论，再给理由

## 业务优先级
- 现金流优先于利润率
- 当前阶段重点是客户增长

## AI 交互
- 回答精简，不过多解释
- 重要操作前先确认
`;

const PREF_TEMPLATE_EN = `# Personal Preferences

## Communication Style
- Concise and direct, reply in English
- Lead with the conclusion, then the reasoning

## Business Priorities
- Cash flow over profit margin
- Current focus: client growth

## AI Interaction
- Brief answers, no over-explaining
- Confirm before important actions
`;

const MAX_PREF_SIZE = 10 * 1024; // 10KB — keeps prompt efficient

function PreferencesBlock({ getField, setField, savePreferences }: {
  getField: (field: string) => string;
  setField: (field: string, value: string) => void;
  savePreferences: (value: string) => void;
}) {
  const { t, lang } = useT();
  const showToast = useUIStore(s => s.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const value = getField('personalPreferences');

  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const flashSaved = () => {
    setJustSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setJustSaved(false), 2000);
  };

  const handleChange = (v: string) => {
    setField('personalPreferences', v);
    setDirty(true);
  };

  const handleBlur = () => {
    if (!dirty) return;
    savePreferences(value);
    setDirty(false);
    flashSaved();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PREF_SIZE) {
      showToast(t("settings.preferences.fileTooLarge"));
      e.target.value = '';
      return;
    }
    if (value.trim() && !window.confirm(t("settings.preferences.overwriteConfirm"))) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setField('personalPreferences', text);
      savePreferences(text);
      setDirty(false);
      flashSaved();
      showToast(t("settings.preferences.importSuccess"));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const blob = new Blob([value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `solo-ceo-preferences-${dateStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTemplate = () => {
    if (value.trim() && !window.confirm(t("settings.preferences.overwriteConfirm"))) return;
    const tpl = lang === 'zh' ? PREF_TEMPLATE_ZH : PREF_TEMPLATE_EN;
    setField('personalPreferences', tpl);
    savePreferences(tpl);
    setDirty(false);
    flashSaved();
  };

  const handleClear = () => {
    if (!window.confirm(t("settings.preferences.clearConfirm"))) return;
    setField('personalPreferences', '');
    savePreferences('');
    setDirty(false);
    flashSaved();
  };

  const charCount = value.length;
  const byteCount = new Blob([value]).size;
  const kbUsed = (byteCount / 1024).toFixed(1);
  const kbLimit = Math.round(MAX_PREF_SIZE / 1024);
  const overLimit = byteCount > MAX_PREF_SIZE;

  return (
    <div className="card p-4 space-y-4 mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
            <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
            {t("settings.preferences.title")}
          </h3>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {t("settings.preferences.description")}
          </p>
        </div>
        <span
          className="text-[12px] flex items-center gap-1 shrink-0"
          style={{
            color: 'var(--color-success)',
            opacity: justSaved ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
          aria-live="polite"
        >
          <Check size={12} />
          {t("settings.preferences.saved")}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={t("settings.preferences.placeholder")}
        className="input-base w-full px-3 py-2.5 text-[14px] resize-none"
        style={{ minHeight: 120, maxHeight: 300, lineHeight: 1.6 }}
        rows={6}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown" className="hidden" onChange={handleImport} />
          <button
            onClick={handleTemplate}
            className="btn-ghost compact flex items-center gap-1.5 text-[13px]"
            style={{ color: 'var(--color-accent)' }}
          >
            <FileText size={14} />
            {t("settings.preferences.template")}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost compact flex items-center gap-1.5 text-[13px]"
          >
            <Upload size={14} />
            {t("settings.preferences.import")}
          </button>
          <button
            onClick={handleExport}
            disabled={!value.trim()}
            className="btn-ghost compact flex items-center gap-1.5 text-[13px] disabled:opacity-40"
          >
            <Download size={14} />
            {t("settings.preferences.export")}
          </button>
          {value.trim() && (
            <button
              onClick={handleClear}
              className="btn-ghost compact flex items-center gap-1.5 text-[13px]"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              {t("settings.preferences.clear")}
            </button>
          )}
        </div>
        <span
          className="text-[12px] tabular-nums"
          style={{ color: overLimit ? 'var(--color-danger)' : 'var(--color-text-quaternary)' }}
        >
          {charCount} · {kbUsed} / {kbLimit} KB
        </span>
      </div>
    </div>
  );
}
