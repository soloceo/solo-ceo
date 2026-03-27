/**
 * Supabase Realtime subscription manager.
 * Subscribes to postgres_changes on all mutable tables and
 * dispatches DOM events so components can re-fetch.
 */
import { supabase } from './supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const REALTIME_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'content_drafts',
  'today_focus_state', 'today_focus_manual',
] as const;

let channel: RealtimeChannel | null = null;

export function startRealtime() {
  if (channel) return; // already running

  const ch = supabase.channel('db-changes');

  for (const table of REALTIME_TABLES) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
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
    if (status === 'SUBSCRIBED') {
      console.info('[Realtime] Subscribed to all tables');
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('[Realtime] Channel error, will retry');
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
