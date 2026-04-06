import React, { useState } from 'react';
import { Bot, Plus, Pencil, Trash2, Wrench, Play, RotateCcw } from 'lucide-react';
import { useT } from '../../i18n/context';
import PeepIllustration from '../../components/ui/PeepIllustration';
import { useAgents } from '../../hooks/useAgents';
import { useUIStore } from '../../store/useUIStore';
import { AGENT_TEMPLATES } from '../../data/agent-templates';
import AgentModal from './AgentModal';
import AgentTestPanel from './AgentTestPanel';
import type { AgentConfig } from '../../lib/agent-types';

export default function AgentSection() {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const { agents, loading, create, update, remove, resetOne, resetAll } = useAgents();
  const [modalOpen, setModalOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [testAgent, setTestAgent] = useState<AgentConfig | null>(null);
  const [resetOneId, setResetOneId] = useState<number | null>(null);
  const [showResetAll, setShowResetAll] = useState(false);

  const handleCreate = () => {
    setEditAgent(null);
    setModalOpen(true);
  };

  const handleEdit = (agent: AgentConfig) => {
    setEditAgent(agent);
    setModalOpen(true);
  };

  const handleSave = async (data: Partial<AgentConfig>) => {
    try {
      if (editAgent) {
        await update(editAgent.id, data);
      } else {
        await create(data);
      }
      setModalOpen(false);
      setEditAgent(null);
      showToast(t('settings.agents.saved'));
    } catch (e) {
      showToast(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await remove(id);
      setDeleteId(null);
      showToast(t('settings.agents.deleted'));
    } catch (e) {
      setDeleteId(null);
      showToast(String(e));
    }
  };

  const handleResetOne = async (id: number) => {
    try {
      await resetOne(id, lang as 'zh' | 'en');
      setResetOneId(null);
      showToast(t('settings.agents.resetOneDone'));
    } catch (e) { showToast(String(e)); }
  };

  const handleResetAll = async () => {
    try {
      await resetAll(lang as 'zh' | 'en');
      setShowResetAll(false);
      showToast(t('settings.agents.resetAllDone'));
    } catch (e) { showToast(String(e)); }
  };

  const getTemplateName = (templateId: string) => {
    const tmpl = AGENT_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return t('settings.agents.custom');
    return lang === 'en' ? tmpl.name.en : tmpl.name.zh;
  };

  return (
    <section id="settings-agents">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot size={16} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-[15px]" style={{ fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
            {t('settings.agents.title')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {showResetAll ? (
            <div className="flex items-center gap-1">
              <button onClick={handleResetAll} className="btn-ghost compact text-[12px]" style={{ color: 'var(--color-danger)' }}>
                {t('common.confirm')}
              </button>
              <button onClick={() => setShowResetAll(false)} className="btn-ghost compact text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetAll(true)}
              className="btn-ghost compact flex items-center gap-1 text-[13px]"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label={t('settings.agents.resetAll')}
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            onClick={handleCreate}
            className="btn-ghost compact flex items-center gap-1 text-[13px]"
            style={{ color: 'var(--color-accent)' }}
            aria-label={t('common.create')}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('settings.agents.desc')}
        </p>

        {loading && agents.length === 0 ? (
          <div className="py-6 text-center text-[14px]" style={{ color: 'var(--color-text-quaternary)' }}>
            Loading...
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <PeepIllustration name="mechanical-love" size={100} />
            <div>
              <p className="text-[15px]" style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                {t('settings.agents.empty')}
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('settings.agents.emptyDesc')}
              </p>
            </div>
            <button onClick={handleCreate} className="btn-primary compact text-[14px]">
              <Plus size={14} />
              {t('settings.agents.emptyBtn')}
            </button>
          </div>
        ) : (
          /* Agent list */
          <div className="divide-y divide-[var(--color-line-secondary)]">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2.5 px-2 py-2"
                onClick={() => handleEdit(agent)}
                style={{ cursor: 'pointer' }}
              >
                {/* Avatar */}
                <span className="text-lg shrink-0">{agent.avatar || '🤖'}</span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] truncate" style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                      {agent.name}
                    </span>
                    {agent.template_id && (
                      <span
                        className="text-[10px] px-1.5 py-px rounded-full whitespace-nowrap shrink-0"
                        style={{ background: 'var(--color-accent-tint)', color: 'var(--color-accent)' }}
                      >
                        {getTemplateName(agent.template_id)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Wrench size={9} style={{ color: 'var(--color-text-quaternary)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--color-text-quaternary)' }}>
                      {t('settings.agents.tools').replace('{count}', String(agent.tools?.length || 0))}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setTestAgent(agent)}
                    className="btn-ghost compact"
                    style={{ color: 'var(--color-accent)' }}
                    title={t('settings.agents.modal.test')}
                  >
                    <Play size={13} />
                  </button>
                  {deleteId === agent.id ? (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => handleDelete(agent.id)} className="btn-ghost compact text-[11px]" style={{ color: 'var(--color-danger)' }}>
                        {t('common.delete')}
                      </button>
                      <button onClick={() => setDeleteId(null)} className="btn-ghost compact text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : resetOneId === agent.id ? (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => handleResetOne(agent.id)} className="btn-ghost compact text-[11px]" style={{ color: 'var(--color-warning)' }}>
                        {t('common.confirm')}
                      </button>
                      <button onClick={() => setResetOneId(null)} className="btn-ghost compact text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(agent.id)}
                      className="btn-ghost compact"
                      style={{ color: 'var(--color-text-quaternary)' }}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <AgentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditAgent(null); }}
          onSave={handleSave}
          editAgent={editAgent}
        />
      )}

      {/* Test Panel */}
      {testAgent && (
        <AgentTestPanel
          open={!!testAgent}
          onClose={() => setTestAgent(null)}
          agent={testAgent}
        />
      )}
    </section>
  );
}
