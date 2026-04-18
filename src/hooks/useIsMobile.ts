import { useState, useEffect } from "react";

/**
 * Single source of truth for the mobile/desktop breakpoint.
 * Tailwind's `md:` prefix (≥768 px) is the dominant layout flip in the app —
 * hiding the mobile navigation, collapsing the sidebar, toggling tab strips.
 * `useIsMobile` was previously returning true below 1024 (the `lg:` break),
 * so the 768–1023 window had CSS rendering the desktop layout while JS code
 * that branched on `useIsMobile` still assumed mobile — a real inconsistency.
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when viewport width is below `MOBILE_BREAKPOINT`.
 * Uses `matchMedia` with a listener so resizing across the breakpoint flips
 * cleanly, instead of the older `resize` + debounce pattern that fired
 * constantly even when the actual breakpoint state wasn't changing.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
