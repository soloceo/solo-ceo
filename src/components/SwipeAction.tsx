import React, { useRef, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";

/**
 * Wrap any list item to add swipe-left-to-reveal-delete on mobile.
 * On desktop, no swipe — just passes through children.
 */
export default function SwipeAction({
  children,
  onDelete,
  disabled = false,
  label,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const [offset, setOffset] = useState(0);
  const [showAction, setShowAction] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    swiping.current = true;
  }, [disabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    currentX.current = e.touches[0].clientX;
    const dx = currentX.current - startX.current;
    // Only allow left swipe (negative)
    if (dx > 10) { swiping.current = false; setOffset(0); return; }
    const clamped = Math.max(dx, -80);
    setOffset(clamped);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;
    if (offset < -40) {
      setOffset(-72);
      setShowAction(true);
    } else {
      setOffset(0);
      setShowAction(false);
    }
  }, [offset]);

  const close = useCallback(() => {
    setOffset(0);
    setShowAction(false);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Delete action behind */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center transition-opacity"
        style={{
          width: 72,
          background: "var(--color-danger)",
          opacity: showAction ? 1 : Math.min(Math.abs(offset) / 40, 1),
        }}
      >
        <button
          onClick={() => { onDelete(); close(); }}
          className="flex flex-col items-center gap-1" style={{ color: "var(--color-text-on-color)" }}
          aria-label="Delete"
        >
          <Trash2 size={16} />
          <span className="text-[13px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{label || "Delete"}</span>
        </button>
      </div>

      {/* Content layer */}
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={showAction ? close : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? "none" : "transform 0.2s ease-out",
          position: "relative",
          zIndex: 1,
          background: "var(--color-bg-primary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
