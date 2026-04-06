/**
 * Hook for managing AI Agents — CRUD + cache + realtime refresh.
 * Uses custom 'agents-changed' event for cross-component sync (works offline too).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import type { AgentConfig } from '../lib/agent-types';

let agentsCache: AgentConfig[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 10_000; // 10s
const AGENTS_EVENT = 'agents-changed';

/** Notify all hook instances that agents changed */
function notifyAgentsChanged() {
  window.dispatchEvent(new CustomEvent(AGENTS_EVENT));
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentConfig[]>(agentsCache || []);
  const [loading, setLoading] = useState(!agentsCache);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      const data = await api.get<AgentConfig[]>('/api/agents');
      agentsCache = data;
      cacheTs = Date.now();
      if (mountedRef.current) {
        setAgents(data);
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!agentsCache || Date.now() - cacheTs > CACHE_TTL) fetch();
    else { setAgents(agentsCache); setLoading(false); }

    // Listen for both Supabase realtime (online) and custom events (offline)
    const realtimeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.table === 'ai_agents') fetch();
    };
    const localHandler = () => fetch();

    window.addEventListener('supabase-change', realtimeHandler);
    window.addEventListener(AGENTS_EVENT, localHandler);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('supabase-change', realtimeHandler);
      window.removeEventListener(AGENTS_EVENT, localHandler);
    };
  }, [fetch]);

  const create = useCallback(async (agent: Partial<AgentConfig>) => {
    const res = await api.post<{ id: number; success: boolean }>('/api/agents', agent);
    await fetch();
    notifyAgentsChanged();
    return res.id;
  }, [fetch]);

  const update = useCallback(async (id: number, patch: Partial<AgentConfig>) => {
    await api.put(`/api/agents/${id}`, patch);
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  const remove = useCallback(async (id: number) => {
    await api.del(`/api/agents/${id}`);
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  /** Seed default agents from templates (for first-time users) */
  const seedDefaults = useCallback(async (lang: 'zh' | 'en') => {
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    // Check existing agents first to avoid duplicates
    let existing: AgentConfig[] = [];
    try { existing = await api.get<AgentConfig[]>('/api/agents'); } catch { /* empty */ }
    const existingTemplateIds = new Set(existing.filter(a => a.template_id).map(a => a.template_id));

    const ids: number[] = [];
    for (const tmpl of AGENT_TEMPLATES) {
      if (existingTemplateIds.has(tmpl.id)) continue; // already exists
      try {
        const res = await api.post<{ id: number; success: boolean }>('/api/agents', {
          name: tmpl.name[lang],
          avatar: tmpl.avatar,
          role: tmpl.role[lang],
          personality: tmpl.personality[lang],
          rules: tmpl.rules[lang],
          tools: tmpl.tools,
          conversation_starters: tmpl.starters[lang],
          template_id: tmpl.id,
          is_default: true,
          sort_order: AGENT_TEMPLATES.indexOf(tmpl),
        });
        if (res.id) ids.push(res.id);
      } catch { /* skip failed */ }
    }
    await fetch();
    notifyAgentsChanged();
    return ids;
  }, [fetch]);

  /** Seed missing templates + upgrade existing template-based agents on version bump */
  const seedMissing = useCallback(async (lang: 'zh' | 'en', existingAgents: AgentConfig[]) => {
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    const existingByTemplate = new Map(
      existingAgents.filter(a => a.template_id).map(a => [a.template_id, a])
    );

    let changed = false;
    const ids: number[] = [];

    // ── Migration: handle consolidated templates (8→5) ──
    // Rename writer → content
    const oldWriter = existingByTemplate.get('writer');
    if (oldWriter?.is_default && !existingByTemplate.has('content')) {
      try {
        await api.put(`/api/agents/${oldWriter.id}`, { template_id: 'content' });
        existingByTemplate.set('content', { ...oldWriter, template_id: 'content' });
        existingByTemplate.delete('writer');
        changed = true;
      } catch { /* skip */ }
    }
    // Soft-delete removed templates (their capabilities merged into others)
    const removedTemplates = ['client-success', 'researcher', 'reviewer'];
    for (const tid of removedTemplates) {
      const old = existingByTemplate.get(tid);
      if (old?.is_default) {
        try { await api.del(`/api/agents/${old.id}`); changed = true; } catch { /* skip */ }
      }
    }

    for (const tmpl of AGENT_TEMPLATES) {
      const existing = existingByTemplate.get(tmpl.id);
      if (!existing) {
        // New template — create it
        try {
          const res = await api.post<{ id: number; success: boolean }>('/api/agents', {
            name: tmpl.name[lang],
            avatar: tmpl.avatar,
            role: tmpl.role[lang],
            personality: tmpl.personality[lang],
            rules: tmpl.rules[lang],
            tools: tmpl.tools,
            conversation_starters: tmpl.starters[lang],
            template_id: tmpl.id,
            is_default: true,
            sort_order: AGENT_TEMPLATES.indexOf(tmpl),
          });
          if (res.id) { ids.push(res.id); changed = true; }
        } catch { /* skip failed */ }
      } else if (existing.is_default) {
        // Existing default agent — only upgrade tools & avatar (safe), preserve user-edited text fields
        const tTools = tmpl.tools;
        const toolsChanged = JSON.stringify(existing.tools?.slice().sort()) !== JSON.stringify([...tTools].sort());
        const avatarChanged = existing.avatar !== tmpl.avatar;
        if (toolsChanged || avatarChanged) {
          try {
            const patch: Record<string, unknown> = { sort_order: AGENT_TEMPLATES.indexOf(tmpl) };
            if (toolsChanged) patch.tools = tTools;
            if (avatarChanged) patch.avatar = tmpl.avatar;
            await api.put(`/api/agents/${existing.id}`, patch);
            changed = true;
          } catch { /* skip failed */ }
        }
      }
    }

    if (changed) {
      await fetch();
      notifyAgentsChanged();
    }
    return ids;
  }, [fetch]);

  /** Reset a single template-based agent back to its template defaults */
  const resetOne = useCallback(async (id: number, lang: 'zh' | 'en') => {
    const agent = agentsCache?.find(a => a.id === id);
    if (!agent?.template_id) return;
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    const tmpl = AGENT_TEMPLATES.find(t => t.id === agent.template_id);
    if (!tmpl) return;
    await api.put(`/api/agents/${id}`, {
      name: tmpl.name[lang],
      avatar: tmpl.avatar,
      role: tmpl.role[lang],
      personality: tmpl.personality[lang],
      rules: tmpl.rules[lang],
      tools: tmpl.tools,
      conversation_starters: tmpl.starters[lang],
      sort_order: AGENT_TEMPLATES.indexOf(tmpl),
      is_default: true,
    });
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  /** Reset ALL template agents to defaults + restore deleted ones */
  const resetAll = useCallback(async (lang: 'zh' | 'en') => {
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    let existing: AgentConfig[] = [];
    try { existing = await api.get<AgentConfig[]>('/api/agents'); } catch { /* empty */ }
    const byTemplate = new Map(existing.filter(a => a.template_id).map(a => [a.template_id, a]));

    for (const tmpl of AGENT_TEMPLATES) {
      const ex = byTemplate.get(tmpl.id);
      const data = {
        name: tmpl.name[lang],
        avatar: tmpl.avatar,
        role: tmpl.role[lang],
        personality: tmpl.personality[lang],
        rules: tmpl.rules[lang],
        tools: tmpl.tools,
        conversation_starters: tmpl.starters[lang],
        template_id: tmpl.id,
        is_default: true,
        sort_order: AGENT_TEMPLATES.indexOf(tmpl),
      };
      if (ex) {
        await api.put(`/api/agents/${ex.id}`, data);
      } else {
        await api.post('/api/agents', data);
      }
    }
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  return { agents, loading, reload: fetch, create, update, remove, seedDefaults, seedMissing, resetOne, resetAll };
}
