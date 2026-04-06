import React, { useState } from 'react';
import { Bot, Plus, Pencil, Trash2, Wrench, Play } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useAgents } from '../../hooks/useAgents';
import { useUIStore } from '../../store/useUIStore';
import { AGENT_TEMPLATES } from '../../data/agent-templates';
import AgentModal from './AgentModal';
import AgentTestPanel from './AgentTestPanel';
import type { AgentConfig } from '../../lib/agent-types';

export default function AgentSection() {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const { agents, loading, create, update, remove } = useAgents();
  const [modalOpen, setModalOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [testAgent, setTestAgent] = useState<AgentConfig | null>(null);

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
      showToast(String(e));
    }
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
        <button
          onClick={handleCreate}
          className="btn-ghost compact flex items-center gap-1 text-[13px]"
          style={{ color: 'var(--color-accent)' }}
        >
          <Plus size={14} />
          {t('settings.agents.create')}
        </button>
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
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ background: 'var(--color-accent-tint)' }}
            >
              🤖
            </div>
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
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 rounded-[var(--radius-8)] px-3 py-2.5"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-translucent)',
                }}
              >
                {/* Avatar */}
                <span className="text-xl shrink-0">{agent.avatar || '🤖'}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="text-[15px] truncate block" style={{ fontWeight: 'var(--font-weight-medium)' } as React.CSSProperties}>
                    {agent.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Wrench size={10} style={{ color: 'var(--color-text-quaternary)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--color-text-quaternary)' }}>
                      {t('settings.agents.tools').replace('{count}', String(agent.tools?.length || 0))}
                    </span>
                    {agent.template_id && (
                      <span
                        className="text-[10px] px-1.5 rounded-full whitespace-nowrap"
                        style={{
                          background: 'var(--color-accent-tint)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {getTemplateName(agent.template_id)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center shrink-0">
                <button
                  onClick={() => setTestAgent(agent)}
                  className="btn-ghost compact"
                  style={{ color: 'var(--color-accent)' }}
                  title={t('settings.agents.modal.test')}
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={() => handleEdit(agent)}
                  className="btn-ghost compact"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <Pencil size={14} />
                </button>
                {agent.template_id === 'general' && agent.is_default ? (
                  /* Default general agent cannot be deleted */
                  <span className="btn-ghost compact" style={{ color: 'var(--color-text-quaternary)', opacity: 0.3, cursor: 'not-allowed' }} title={lang === 'en' ? 'Default agent cannot be deleted' : '默认助手不可删除'}>
                    <Trash2 size={14} />
                  </span>
                ) : deleteId === agent.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="btn-ghost compact text-[12px]"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      {lang === 'en' ? 'Yes' : '确认'}
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="btn-ghost compact text-[12px]"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {lang === 'en' ? 'No' : '取消'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteId(agent.id)}
                    className="btn-ghost compact"
                    style={{ color: 'var(--color-text-quaternary)' }}
                  >
                    <Trash2 size={14} />
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
