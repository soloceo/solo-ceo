import React, { useState, useRef, useCallback } from "react";

/**
 * Reusable hook for swipeable tab panels on mobile.
 * Returns refs, handlers, and state to wire up a two-panel swipe layout.
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

  const onTouchMove = useCallback((e: React.TouchEvent) => {
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
  }, []);

  return { activeTab, setActiveTab, switchTo, swipeRef, handleScroll, onTouchStart, onTouchMove };
}
