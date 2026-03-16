import { useState, useCallback } from "react";

/** Simple toast state: returns [message, showToast]. */
export function useToast(duration = 3000): [string, (msg: string) => void] {
  const [toast, setToast] = useState("");

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(""), duration);
    },
    [duration],
  );

  return [toast, showToast];
}
