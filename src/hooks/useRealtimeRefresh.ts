import { useEffect, useCallback } from 'react';

/**
 * Re-runs `refetchFn` whenever a Supabase realtime change event
 * is received for any of the given `tables`.
 */
export function useRealtimeRefresh(
  tables: string[],
  refetchFn: () => void,
) {
  const stableRefetch = useCallback(refetchFn, [refetchFn]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.table && tables.includes(detail.table)) {
        stableRefetch();
      }
    };
    window.addEventListener('supabase-change', handler);
    return () => window.removeEventListener('supabase-change', handler);
  }, [tables, stableRefetch]);
}
