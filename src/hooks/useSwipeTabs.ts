import { useState, useRef, useCallback } from "react";

/**
 * Reusable hook for swipeable tab panels on mobile.
 * Returns refs, handlers, and state to wire up a two-panel swipe layout.
 *
 * Relies entirely on native CSS scroll-snap for swipe behavior:
 *   - scroll-snap-type: x mandatory   (on container)
 *   - scroll-snap-align: start        (on panels)
 *   - overscroll-behavior-x: contain   (prevents scroll leak to parent)
 *
 * No custom touch handlers — calling preventDefault() on touch events
 * would block the container's own native scroll and break snap.
 */
export function useSwipeTabs<T extends string>(tabs: readonly [T, T], initial?: T) {
  const [activeTab, setActiveTab] = useState<T>(initial ?? tabs[0]);
  const swipeRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = swipeRef.current;
    if (!el) return;
    const ratio = el.scrollLeft / el.clientWidth;
    setActiveTab(ratio > 0.5 ? tabs[1] : tabs[0]);
  }, [tabs]);

  const switchTo = useCallback((tab: T) => {
    setActiveTab(tab);
    const el = swipeRef.current;
    if (!el) return;
    el.scrollTo({ left: tab === tabs[1] ? el.clientWidth : 0, behavior: "smooth" });
  }, [tabs]);

  // No-ops kept for API compatibility — callers still pass these to JSX
  const onTouchStart = useCallback((_e: React.TouchEvent) => {}, []);
  const onTouchMove = useCallback((_e: React.TouchEvent) => {}, []);

  return { activeTab, setActiveTab, switchTo, swipeRef, handleScroll, onTouchStart, onTouchMove };
}
