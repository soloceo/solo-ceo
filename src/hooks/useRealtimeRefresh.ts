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
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.table && tables.includes(detail.table)) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => stableRefetch(), 300);
      }
    };
    window.addEventListener('supabase-change', handler);
    return () => {
      window.removeEventListener('supabase-change', handler);
      clearTimeout(timer.current);
    };
  }, [tables, stableRefetch]);
}
