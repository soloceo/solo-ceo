import { useRef, useEffect, useCallback } from 'react';

/**
 * Lightweight pull-to-refresh for mobile.
 * Attaches to a scrollable container ref.
 * Calls `onRefresh` when user pulls down > threshold from scroll top.
 */
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
  { threshold = 60, enabled = true } = {},
) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const indicator = useRef<HTMLDivElement | null>(null);

  const createIndicator = useCallback(() => {
    if (indicator.current) return indicator.current;
    const el = document.createElement('div');
    el.className = 'pull-refresh-indicator';
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
    el.style.cssText = `
      position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow-sm); color: var(--accent);
      transition: transform 0.2s, opacity 0.2s; opacity: 0; z-index: 10;
    `;
    containerRef.current?.style.setProperty('position', 'relative');
    containerRef.current?.prepend(el);
    indicator.current = el;
    return el;
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (container.scrollTop > 5 || refreshing.current) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy < 0) { pulling.current = false; return; }

      const el = createIndicator();
      const progress = Math.min(dy / threshold, 1);
      el.style.transform = `translateX(-50%) translateY(${Math.min(dy * 0.4, 60)}px)`;
      el.style.opacity = String(progress);
      (el.firstChild as SVGElement).style.transform = `rotate(${progress * 360}deg)`;
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      const el = indicator.current;

      if (el && parseFloat(el.style.opacity) >= 0.95) {
        // Trigger refresh
        refreshing.current = true;
        el.style.transform = 'translateX(-50%) translateY(40px)';
        (el.firstChild as SVGElement).style.animation = 'spin 0.6s linear infinite';
        try { await onRefresh(); } catch {}
        refreshing.current = false;
      }

      // Reset
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(0)';
        (el.firstChild as SVGElement).style.animation = '';
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      if (indicator.current) { indicator.current.remove(); indicator.current = null; }
    };
  }, [containerRef, onRefresh, threshold, enabled, createIndicator]);
}
