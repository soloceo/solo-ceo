import { useState, useEffect } from "react";

const MQ = "(max-width: 1023px)";

/** Returns `true` when viewport width < 1024 px (lg breakpoint, matches CSS). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MQ).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(MQ);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
