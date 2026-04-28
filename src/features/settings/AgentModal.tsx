import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { useT } from '../../i18n/context';
import { AGENT_TEMPLATES, type AgentTemplate } from '../../data/agent-templates';
import { ALL_TOOL_NAMES, TOOL_LABELS, type AgentToolName } from '../../lib/agent-types';
import type { AgentConfig } from '../../lib/agent-types';

interface AgentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<AgentConfig>) => void;
  editAgent: AgentConfig | null;
}

const AVATAR_OPTIONS = ['🤖', '🎯', '📋', '💰', '🤝', '🔍', '🧠', '💡', '🚀', '⭐', '🎨', '📊', '🔧', '🌟', '💼', '🛡️', '📈', '🎪', '🦊', '🐬'];

export default function AgentModal({ open, onClose, onSave, editAgent }: AgentModalProps) {
  const { t, lang } = useT();
  const isEdit = !!editAgent;

  // Step: 'template' (only on create) or 'form'
  const [step, setStep] = useState<'template' | 'form'>(isEdit ? 'form' : 'template');

  // Form state
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');
  const [personality, setPersonality] = useState('');
  const [rules, setRules] = useState('');
  const [tools, setTools] = useState<AgentToolName[]>([...ALL_TOOL_NAMES]);
  const [starters, setStarters] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [nameError, setNameError] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (editAgent) {
      setName(editAgent.name);
      setAvatar(editAgent.avatar || '🤖');
      setRole(editAgent.role || '');
      setPersonality(editAgent.personality || '');
      setRules(editAgent.rules || '');
      setTools((editAgent.tools || []) as AgentToolName[]);
      setStarters(editAgent.conversation_starters || []);
      setTemplateId(editAgent.template_id || '');
      setStep('form');
    }
  }, [editAgent]);

  const applyTemplate = (tmpl: AgentTemplate) => {
    const l = lang === 'en' ? 'en' : 'zh';
    setName(tmpl.name[l]);
    setAvatar(tmpl.avatar);
    setRole(tmpl.role[l]);
    setPersonality(tmpl.personality[l]);
    setRules(tmpl.rules[l]);
    setTools([...tmpl.tools]);
    setStarters([...tmpl.starters[l]]);
    setTemplateId(tmpl.id);
    setStep('form');
  };

  const startBlank = () => {
    setName('');
    setAvatar('🤖');
    setRole('');
    setPersonality('');
    setRules('');
    setTools([...ALL_TOOL_NAMES]);
    setStarters([]);
    setTemplateId('');
    setStep('form');
  };

  const toggleTool = (toolName: AgentToolName) => {
    setTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const addStarter = () => {
    setStarters(prev => [...prev, '']);
  };

  const updateStarter = (index: number, value: string) => {
    setStarters(prev => prev.map((s, i) => i === index ? value : s));
  };

  const removeStarter = (index: number) => {
    setStarters(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(() => {
    if (!name.trim()) { setNameError(true); return; }
    setNameError(false);
    // Validate tools against known set
    const validTools = tools.filter(t => ALL_TOOL_NAMES.includes(t));
    onSave({
      name: name.trim(),
      avatar: avatar || '🤖',
      role,
      personality,
      rules,
      tools: validTools,
      conversation_starters: starters.filter(s => s.trim()),
      template_id: templateId,
    });
  }, [name, avatar, role, personality, rules, tools, starters, templateId, onSave]);

  // Escape to close, Cmd+Enter to save
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, handleSubmit]);

  const l = lang === 'en' ? 'en' : 'zh';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 'var(--layer-dialog)' }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'var(--color-overlay-primary)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-lg rounded-[var(--radius-12)] overflow-hidden flex flex-col"
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-translucent)',
              boxShadow: 'var(--shadow-high)',
              maxHeight: '85vh',
            }}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--color-line-secondary)' }}
            >
              <div className="flex items-center gap-2">
                {step === 'form' && !isEdit && (
                  <button
                    onClick={() => setStep('template')}
                    className="btn-ghost compact"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <h3 className="text-[16px]" style={{ fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
                  {isEdit ? t('settings.agents.modal.edit') : step === 'template' ? t('settings.agents.modal.template') : t('settings.agents.modal.create')}
                </h3>
              </div>
              <button onClick={onClose} className="btn-ghost compact" style={{ color: 'var(--color-text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {step === 'template' ? (
                /* ── Template Selection ────────── */
                <div className="space-y-3">
                  <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t('settings.agents.modal.templateDesc')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENT_TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl)}
                        className="flex items-start gap-2.5 rounded-[var(--radius-8)] p-3 text-left"
                        style={{
                          background: 'var(--color-bg-tertiary)',
                          border: '1px solid var(--color-border-translucent)',
                        }}
                      >
                        <span className="text-xl mt-0.5 shrink-0">{tmpl.avatar}</span>
                        <div className="min-w-0">
                          <div className="text-[14px] truncate" style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                            {tmpl.name[l]}
                          </div>
                          <div className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            {tmpl.description[l]}
                          </div>
                        </div>
                      </button>
                    ))}
                    {/* Blank option */}
                    <button
                      onClick={startBlank}
                      className="flex items-start gap-2.5 rounded-[var(--radius-8)] p-3 text-left"
                      style={{
                        background: 'var(--color-bg-tertiary)',
                        border: '1px dashed var(--color-border-translucent)',
                      }}
                    >
                      <span className="text-xl mt-0.5 shrink-0">✨</span>
                      <div className="min-w-0">
                        <div className="text-[14px] truncate" style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                          {t('settings.agents.modal.customBlank')}
                        </div>
                        <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          {t('settings.agents.modal.customDesc')}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Agent Form ────────── */
                <div className="space-y-4">

                  {/* Name + Avatar */}
                  <div className="flex items-start gap-3">
                    {/* Avatar picker */}
                    <div className="shrink-0">
                      <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('settings.agents.modal.avatar')}
                      </label>
                      <div className="relative group">
                        <button
                          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-8)] text-2xl"
                          style={{
                            background: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border-translucent)',
                          }}
                          onClick={(e) => {
                            const el = e.currentTarget.nextElementSibling as HTMLElement;
                            if (el) el.style.display = el.style.display === 'grid' ? 'none' : 'grid';
                          }}
                        >
                          {avatar}
                        </button>
                        <div
                          className="absolute top-full left-0 mt-1 p-2 rounded-[var(--radius-8)]"
                          style={{
                            display: 'none',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: 4,
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border-translucent)',
                            boxShadow: 'var(--shadow-high)',
                            zIndex: 'var(--layer-float)',
                          }}
                        >
                          {AVATAR_OPTIONS.map(em => (
                            <button
                              key={em}
                              onClick={(e) => {
                                setAvatar(em);
                                const grid = (e.currentTarget.parentElement as HTMLElement);
                                if (grid) grid.style.display = 'none';
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-4)] text-xl hover:scale-110 transition-transform"
                              style={{
                                background: avatar === em ? 'var(--color-accent-tint)' : 'transparent',
                              }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Name */}
                    <div className="flex-1">
                      <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('settings.agents.modal.name')}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setNameError(false); }}
                        placeholder={t('settings.agents.modal.namePlaceholder')}
                        className="input-base w-full px-3 py-2 text-[15px]"
                        style={{
                          borderColor: nameError ? 'var(--color-danger)' : undefined,
                          fontWeight: 'var(--font-weight-medium)',
                        } as React.CSSProperties}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.agents.modal.role')}
                    </label>
                    <textarea
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder={t('settings.agents.modal.rolePlaceholder')}
                      className="input-base w-full px-3 py-2 text-[14px] resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Personality */}
                  <div>
                    <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.agents.modal.personality')}
                    </label>
                    <textarea
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      placeholder={t('settings.agents.modal.personalityPlaceholder')}
                      className="input-base w-full px-3 py-2 text-[14px] resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Rules */}
                  <div>
                    <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.agents.modal.rules')}
                    </label>
                    <textarea
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      placeholder={t('settings.agents.modal.rulesPlaceholder')}
                      className="input-base w-full px-3 py-2 text-[14px] resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--color-line-secondary)' }} />

                  {/* Tools */}
                  <div>
                    <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.agents.modal.tools')}
                    </label>
                    <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-quaternary)' }}>
                      {t('settings.agents.modal.toolsDesc')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ALL_TOOL_NAMES.map(toolName => {
                        const active = tools.includes(toolName);
                        const label = TOOL_LABELS[toolName];
                        return (
                          <button
                            key={toolName}
                            onClick={() => toggleTool(toolName)}
                            className="flex items-center gap-2 rounded-[var(--radius-6)] px-2.5 py-2 text-left text-[13px]"
                            style={{
                              background: active ? 'var(--color-accent-tint)' : 'var(--color-bg-tertiary)',
                              color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                              border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border-translucent)'}`,
                              fontWeight: active ? 'var(--font-weight-medium)' : 'normal',
                            } as React.CSSProperties}
                          >
                            <Sparkles size={12} />
                            {lang === 'en' ? label.en : label.zh}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--color-line-secondary)' }} />

                  {/* Conversation Starters */}
                  <div>
                    <label className="text-[13px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.agents.modal.starters')}
                    </label>
                    <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-quaternary)' }}>
                      {t('settings.agents.modal.startersDesc')}
                    </p>
                    <div className="space-y-2">
                      {starters.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={s}
                            onChange={(e) => updateStarter(i, e.target.value)}
                            placeholder={t('settings.agents.modal.starterPlaceholder')}
                            className="input-base flex-1 px-3 py-1.5 text-[13px]"
                          />
                          <button
                            onClick={() => removeStarter(i)}
                            className="btn-ghost compact shrink-0"
                            style={{ color: 'var(--color-text-quaternary)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {starters.length < 6 && (
                        <button
                          onClick={addStarter}
                          className="btn-ghost compact text-[13px] flex items-center gap-1"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <Plus size={13} />
                          {t('settings.agents.modal.addStarter')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step === 'form' && (
              <div
                className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
                style={{ borderTop: '1px solid var(--color-line-secondary)' }}
              >
                <button onClick={onClose} className="btn-secondary compact text-[14px]">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={!name.trim()} className="btn-primary compact text-[14px] flex items-center gap-1.5 disabled:opacity-40">
                  <Save size={14} />
                  {t('settings.agents.modal.save')}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
