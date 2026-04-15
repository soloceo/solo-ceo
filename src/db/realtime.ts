/**
 * Supabase Realtime subscription manager.
 * Subscribes to postgres_changes on all mutable tables and
 * dispatches DOM events so components can re-fetch.
 */
import { supabase } from './supabase-client';
import { invalidateForMutation } from './data-cache';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Map table names to their API paths for cache invalidation
const TABLE_API_PATH: Record<string, string> = {
  leads: '/api/leads',
  clients: '/api/clients',
  tasks: '/api/tasks',
  plans: '/api/plans',
  finance_transactions: '/api/finance',
  payment_milestones: '/api/milestones',
  today_focus_state: '/api/today-focus',
  today_focus_manual: '/api/today-focus',
  client_projects: '/api/clients',
  content_drafts: '/api/content-drafts',
  ai_agents: '/api/agents',
  ai_conversations: '/api/conversations',
};

const REALTIME_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'payment_milestones',
  'today_focus_state', 'today_focus_manual',
  'client_projects', 'content_drafts',
  'ai_agents',
  'ai_conversations',
] as const;

let channel: RealtimeChannel | null = null;

export function startRealtime() {
  if (channel) return; // already running — no leak possible

  const ch = supabase.channel('db-changes');

  for (const table of REALTIME_TABLES) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        // Invalidate SWR cache so refetch gets fresh data (not stale cache).
        // invalidateForMutation already cascades to /api/dashboard internally.
        const apiPath = TABLE_API_PATH[table];
        if (apiPath) invalidateForMutation(apiPath);

        window.dispatchEvent(
          new CustomEvent('supabase-change', {
            detail: {
              table,
              eventType: payload.eventType,          // INSERT | UPDATE | DELETE
              new: payload.new,
              old: payload.old,
            },
          }),
        );
      },
    );
  }

  ch.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      // Channel error — Supabase will auto-retry
    }
  });

  channel = ch;
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
