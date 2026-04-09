import { useState, useEffect, useRef } from 'react';

/**
 * Animate a number from its previous value to the new target.
 * Returns the current display value (animating).
 */
export function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = prev.current;
    const to = target;
    prev.current = to;

    if (from === to) return;

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target, duration]);

  return display;
}
