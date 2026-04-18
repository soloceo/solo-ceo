import { useEffect, useRef } from 'react';
import { useUIStore, type TabId } from '../store/useUIStore';

/**
 * Minimal hash-based routing so `activeTab` becomes shareable / bookmarkable
 * / back-button-friendly.
 *
 * Contract:
 *   /solo-ceo/              → default, resolves to activeTab='home'
 *   /solo-ceo/#/finance     → sets activeTab='finance' on load
 *   click a tab in the sidebar → pushState('#/<tab>') so Back works
 *   browser Back/Forward    → hashchange event → activeTab updates
 *
 * No external dependency. Deliberately narrow: only the 6 top-level tabs
 * are URL-addressable. Nested state (open panel, active filter, etc.) is
 * still driven by component-local state — deep-linking to e.g. "client X
 * billing tab" is a bigger refactor and not covered here.
 */

const VALID_TABS: readonly TabId[] = ['home', 'leads', 'work', 'clients', 'finance', 'settings'] as const;

/** Pure — exported for unit testing without touching window. */
export function parseHashString(hash: string): TabId | null {
  const m = hash.match(/^#\/([a-z-]+)/);
  const candidate = m?.[1];
  return candidate && (VALID_TABS as readonly string[]).includes(candidate) ? (candidate as TabId) : null;
}

function parseHash(): TabId | null {
  return parseHashString(window.location.hash);
}

export function useHashRoute(): void {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  // Differentiate the initial hash→state sync (replaceState, no history
  // entry) from subsequent tab clicks (pushState, so Back goes back).
  const didInitialSync = useRef(false);

  // 1. URL → state on mount + subsequent hashchange (Back/Forward buttons)
  useEffect(() => {
    const onHash = () => {
      const tab = parseHash();
      if (tab && tab !== useUIStore.getState().activeTab) {
        setActiveTab(tab);
      }
    };
    onHash(); // initial read
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [setActiveTab]);

  // 2. state → URL when the user changes tabs via the sidebar
  useEffect(() => {
    const desired = `#/${activeTab}`;
    if (window.location.hash === desired) return;
    if (!didInitialSync.current) {
      // First alignment after mount: overwrite silently so the history
      // stack doesn't start with a redundant entry for the default tab.
      didInitialSync.current = true;
      history.replaceState(null, '', desired);
    } else {
      history.pushState(null, '', desired);
    }
  }, [activeTab]);
}
