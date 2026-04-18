import { useEffect, useRef } from 'react';
import { useUIStore, type QuickCreateType } from '../store/useUIStore';

/**
 * Consume side of the quick-create flow.
 *
 * Pages (FinancePage, LeadsBoard, WorkPage, ClientList) pass the
 * `QuickCreateType` they handle plus an `onTrigger` callback that opens
 * their create panel. Whenever another part of the app calls
 * `setPendingQuickCreate(type)`, the store flips `pendingQuickCreate` to
 * `{ type, token }` with a fresh monotonic token; this hook fires the
 * callback exactly once and then clears the intent so a later un-related
 * tab switch won't accidentally re-trigger.
 *
 * Replaces the old `window.dispatchEvent(new CustomEvent('quick-create'))`
 * + `setTimeout(..., 100)` pattern, which lost events when the target
 * page's listener hadn't mounted yet (lazy chunk race).
 */
export function useQuickCreateIntent(type: QuickCreateType, onTrigger: () => void): void {
  const pending = useUIStore((s) => s.pendingQuickCreate);
  const clear = useUIStore((s) => s.clearPendingQuickCreate);

  // Keep the latest callback in a ref so it doesn't re-run this effect
  // every render — only the store intent actually changing should fire.
  const cbRef = useRef(onTrigger);
  cbRef.current = onTrigger;

  useEffect(() => {
    if (pending?.type === type) {
      cbRef.current();
      clear();
    }
    // `pending` is a fresh object each time setPendingQuickCreate is called
    // (new token), so a consecutive "create the same thing again" still fires.
  }, [pending, type, clear]);
}
