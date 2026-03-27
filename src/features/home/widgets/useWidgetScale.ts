import { useEffect, useState, useCallback, type RefObject } from "react";

const BASE_WIDTH = 160;
const MIN_SCALE = 1;
const MAX_SCALE = 2.5;

/**
 * Measures widget container width via ResizeObserver and returns
 * a scaling function `s(basePx)` that maps 160px-baseline sizes
 * to the actual container size.
 *
 * On mobile (~160px cards): s(68) = 68  (no change)
 * On iPad  (~380px cards): s(68) = 162  (scaled up)
 */
export function useWidgetScale(ref: RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) {
        setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, w / BASE_WIDTH)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  /** Scale a base-160 pixel value to the current container size */
  const s = useCallback((px: number) => Math.round(px * scale), [scale]);

  return { scale, s };
}
