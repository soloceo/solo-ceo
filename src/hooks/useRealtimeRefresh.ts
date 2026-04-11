import { useEffect, useRef } from 'react';

// Map table names to their primary API path for SWR cache-updated matching
const TABLE_TO_PATH: Record<string, string> = {
  leads: '/api/leads',
  clients: '/api/clients',
  tasks: '/api/tasks',
  finance_transactions: '/api/finance',
  plans: '/api/plans',
  payment_milestones: '/api/milestones',
  content_drafts: '/api/content-drafts',
  today_focus_state: '/api/today-focus',
  today_focus_manual: '/api/today-focus',
  client_projects: '/api/clients',
  ai_agents: '/api/agents',
  ai_conversations: '/api/conversations',
};

/**
 * Re-runs `refetchFn` whenever a Supabase realtime change event
 * is received for any of the given `tables`, OR when the SWR cache
 * background-revalidates a matching API path.
 * Debounced: batches rapid-fire events within 300ms into a single refetch.
 */
export function useRealtimeRefresh(
  tables: readonly string[],
  refetchFn: () => void,
) {
  // Store latest refetchFn in a ref so the effect doesn't re-run when the callback changes
  const refetchRef = useRef(refetchFn);
  refetchRef.current = refetchFn;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Stable dep key — prevents re-subscribing when callers pass inline array literals
  const tablesKey = tables.join(',');

  useEffect(() => {
    const scheduleRefetch = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => refetchRef.current(), 300);
    };

    const handleSingle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.table && tables.includes(detail.table)) {
        scheduleRefetch();
      }
    };

    const handleBatch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const changed = detail?.tables as string[] | undefined;
      if (changed?.some(t => tables.includes(t))) {
        scheduleRefetch();
      }
    };

    // SWR cache background revalidation
    const handleCacheUpdate = (e: Event) => {
      const updatedPath = (e as CustomEvent).detail?.path as string | undefined;
      if (!updatedPath) return;
      const matches = tables.some(t => {
        const apiPath = TABLE_TO_PATH[t];
        return apiPath && (updatedPath === apiPath || updatedPath.startsWith(apiPath + '/'));
      });
      if (matches) scheduleRefetch();
    };

    window.addEventListener('supabase-change', handleSingle);
    window.addEventListener('supabase-change-batch', handleBatch);
    window.addEventListener('api-cache-updated', handleCacheUpdate);
    return () => {
      window.removeEventListener('supabase-change', handleSingle);
      window.removeEventListener('supabase-change-batch', handleBatch);
      window.removeEventListener('api-cache-updated', handleCacheUpdate);
      clearTimeout(timer.current);
    };
  }, [tablesKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
