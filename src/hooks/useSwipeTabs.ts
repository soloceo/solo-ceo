import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Reusable hook for swipeable tab panels on mobile.
 * Returns refs, handlers, and state to wire up a two-panel swipe layout.
 *
 * Uses a native (non-passive) touchmove listener so that preventDefault()
 * actually works — React's synthetic onTouchMove is passive by default,
 * which causes horizontal swipes to be captured by ancestor scroll containers.
 */
export function useSwipeTabs<T extends string>(tabs: readonly [T, T], initial?: T) {
  const [activeTab, setActiveTab] = useState<T>(initial ?? tabs[0]);
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ x: 0, y: 0, decided: false, isHorizontal: false });

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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, decided: false, isHorizontal: false };
  }, []);

  // Register a non-passive native touchmove listener so preventDefault() works.
  // This prevents the outer vertical scroll container from stealing horizontal swipes.
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;

    const handleTouchMove = (e: TouchEvent) => {
      const ref = touchRef.current;
      if (ref.decided) {
        if (ref.isHorizontal) e.preventDefault();
        return;
      }
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - ref.x);
      const dy = Math.abs(t.clientY - ref.y);
      if (dx + dy < 8) return;
      ref.decided = true;
      ref.isHorizontal = dx > dy * 1.2;
      if (ref.isHorizontal) e.preventDefault();
    };

    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleTouchMove);
  }, []);

  // onTouchMove kept as no-op for JSX compatibility (actual logic is in native listener)
  const onTouchMove = useCallback((_e: React.TouchEvent) => {}, []);

  return { activeTab, setActiveTab, switchTo, swipeRef, handleScroll, onTouchStart, onTouchMove };
}
