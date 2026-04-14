import { useState, useEffect } from "react";

/** Returns `true` when the primary pointer is coarse (touch-first device).
 *  Use this to gate touch-vs-mouse behavior (e.g. drag activation) — viewport
 *  width alone is wrong because a desktop with a narrow window still has a mouse. */
export function useIsTouchPointer() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isTouch;
}
