import { useEffect, useCallback, useRef } from 'react';

/**
 * Re-runs `refetchFn` whenever a Supabase realtime change event
 * is received for any of the given `tables`.
 * Debounced: batches rapid-fire events within 300ms into a single refetch.
 */
export function useRealtimeRefresh(
  tables: readonly string[],
  refetchFn: () => void,
) {
  const stableRefetch = useCallback(refetchFn, [refetchFn]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const scheduleRefetch = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => stableRefetch(), 300);
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

    window.addEventListener('supabase-change', handleSingle);
    window.addEventListener('supabase-change-batch', handleBatch);
    return () => {
      window.removeEventListener('supabase-change', handleSingle);
      window.removeEventListener('supabase-change-batch', handleBatch);
      clearTimeout(timer.current);
    };
  }, [tables, stableRefetch]);
}
