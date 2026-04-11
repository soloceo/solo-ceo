/**
 * Hook for managing AI Agents — CRUD + cache + realtime refresh.
 * Uses custom 'agents-changed' event for cross-component sync (works offline too).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { invalidateForMutation } from '../db/data-cache';
import type { AgentConfig } from '../lib/agent-types';

let agentsCache: AgentConfig[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 10_000; // 10s
const AGENTS_EVENT = 'agents-changed';
const LS_DISMISSED_TEMPLATES = 'solo_dismissed_agent_templates';

/** Get set of template IDs the user has intentionally deleted */
function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED_TEMPLATES) || '[]')); } catch { return new Set(); }
}
function addDismissed(templateId: string) {
  const s = getDismissed(); s.add(templateId); try { localStorage.setItem(LS_DISMISSED_TEMPLATES, JSON.stringify([...s])); } catch { /* quota exceeded */ }
}
function clearDismissed() {
  localStorage.removeItem(LS_DISMISSED_TEMPLATES);
}

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
      const safe = Array.isArray(data) ? data : [];
      agentsCache = safe;
      cacheTs = Date.now();
      if (mountedRef.current) {
        setAgents(safe);
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
    // Record dismissed template so seedMissing won't recreate it
    const agent = agentsCache?.find(a => a.id === id);
    if (agent?.template_id) addDismissed(agent.template_id);
    // Optimistic update — remove from UI immediately (local state only, no event yet)
    const prev = agentsCache;
    agentsCache = agentsCache ? agentsCache.filter(a => a.id !== id) : [];
    cacheTs = 0;
    if (mountedRef.current) setAgents(agentsCache);
    // Do NOT notifyAgentsChanged() here — other instances would re-fetch stale data
    try {
      await api.del(`/api/agents/${id}`);
      invalidateForMutation('/api/agents');
      // NOW notify — Supabase has committed the delete, re-fetch will see it
      notifyAgentsChanged();
    } catch {
      // Rollback on failure
      agentsCache = prev;
      cacheTs = 0;
      if (mountedRef.current) setAgents(prev || []);
      notifyAgentsChanged();
      throw new Error('Delete failed');
    }
  }, []);

  /** Seed default agents from templates (for first-time users) */
  const seedDefaults = useCallback(async (lang: 'zh' | 'en') => {
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    // Force fresh fetch to avoid stale cache causing duplicate creation
    invalidateForMutation('/api/agents');
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
  const seedMissing = useCallback(async (lang: 'zh' | 'en', _existingAgents: AgentConfig[]) => {
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');
    // Always fetch fresh to avoid stale hook state causing duplicate creation
    invalidateForMutation('/api/agents');
    let freshAgents: AgentConfig[] = _existingAgents;
    try { freshAgents = await api.get<AgentConfig[]>('/api/agents'); } catch { /* use passed-in */ }
    const existingByTemplate = new Map(
      freshAgents.filter(a => a.template_id).map(a => [a.template_id, a])
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

    const dismissed = getDismissed();
    for (const tmpl of AGENT_TEMPLATES) {
      const existing = existingByTemplate.get(tmpl.id);
      if (!existing) {
        // Skip if user intentionally deleted this template
        if (dismissed.has(tmpl.id)) continue;
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
    invalidateForMutation('/api/agents');
    agentsCache = null;
    cacheTs = 0;
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  /** Reset ALL template agents to defaults + restore deleted ones.
   *  Uses UPDATE-in-place instead of delete+create to avoid silent-delete duplication bugs. */
  const resetAll = useCallback(async (lang: 'zh' | 'en') => {
    clearDismissed();
    const { AGENT_TEMPLATES } = await import('../data/agent-templates');

    // Force fresh fetch — bypass SWR cache entirely
    invalidateForMutation('/api/agents');
    agentsCache = null;
    cacheTs = 0;
    let existing: AgentConfig[] = [];
    try { existing = await api.get<AgentConfig[]>('/api/agents'); } catch { /* empty */ }

    // Group existing agents by template_id
    const byTemplate = new Map<string, AgentConfig[]>();
    for (const a of existing) {
      if (a.template_id) {
        const list = byTemplate.get(a.template_id) || [];
        list.push(a);
        byTemplate.set(a.template_id, list);
      }
    }

    for (const tmpl of AGENT_TEMPLATES) {
      const defaults = {
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

      const group = byTemplate.get(tmpl.id) || [];
      if (group.length > 0) {
        // UPDATE the first agent to template defaults
        try { await api.put(`/api/agents/${group[0].id}`, defaults); } catch { /* skip */ }
        // DELETE any duplicates
        for (let i = 1; i < group.length; i++) {
          try { await api.del(`/api/agents/${group[i].id}`); } catch { /* skip */ }
        }
      } else {
        // No agent for this template — create one
        try { await api.post('/api/agents', defaults); } catch { /* skip */ }
      }
    }

    // Force clear all caches before refetch
    invalidateForMutation('/api/agents');
    agentsCache = null;
    cacheTs = 0;
    await fetch();
    notifyAgentsChanged();
  }, [fetch]);

  return { agents, loading, reload: fetch, create, update, remove, seedDefaults, seedMissing, resetOne, resetAll };
}
