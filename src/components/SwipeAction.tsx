import React, { useRef, useState, useCallback } from "react";
import { Trash2, ChevronRight } from "lucide-react";

/**
 * Bidirectional swipe actions for mobile:
 * - Swipe LEFT  → reveal delete (red)
 * - Swipe RIGHT → advance to next stage (green/accent)
 *
 * On desktop (no touch), passes through children unchanged.
 * The component detects horizontal vs vertical intent to avoid
 * hijacking scroll.
 */

interface SwipeActionProps {
  children: React.ReactNode;
  /** Left-swipe action: delete */
  onDelete?: () => void;
  /** Right-swipe action: advance to next stage */
  onAdvance?: () => void;
  /** Label shown on the right-swipe action area */
  advanceLabel?: string;
  /** Label shown on the left-swipe action area */
  deleteLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const THRESHOLD = 48;
const ACTION_WIDTH = 80;

export default function SwipeAction({
  children,
  onDelete,
  onAdvance,
  disabled = false,
  advanceLabel = "Next",
  deleteLabel = "Delete",
  ariaLabel,
}: SwipeActionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = startX.current;
    swiping.current = true;
    directionLocked.current = null;
  }, [disabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    currentX.current = e.touches[0].clientX;
    const dx = currentX.current - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock direction after 10px of movement
    if (!directionLocked.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (directionLocked.current !== "horizontal") {
        swiping.current = false;
        setOffset(0);
        return;
      }
    }

    if (directionLocked.current !== "horizontal") return;

    // Clamp: right swipe (positive) for advance, left swipe (negative) for delete
    let clamped = dx;
    if (dx > 0 && !onAdvance) { clamped = 0; } // no right action
    if (dx < 0 && !onDelete)  { clamped = 0; } // no left action
    clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, clamped));

    // Rubber-band resistance at edges
    if (Math.abs(dx) > ACTION_WIDTH) {
      const excess = Math.abs(dx) - ACTION_WIDTH;
      const sign = dx > 0 ? 1 : -1;
      clamped = sign * (ACTION_WIDTH + excess * 0.2);
    }

    setOffset(clamped);
  }, [onAdvance, onDelete]);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;
    directionLocked.current = null;

    if (offset > THRESHOLD && onAdvance) {
      // Trigger advance
      setOffset(0);
      setRevealed(null);
      onAdvance();
    } else if (offset < -THRESHOLD && onDelete) {
      // Reveal delete action
      setOffset(-ACTION_WIDTH);
      setRevealed("left");
    } else {
      // Snap back
      setOffset(0);
      setRevealed(null);
    }
  }, [offset, onAdvance, onDelete]);

  const close = useCallback(() => {
    setOffset(0);
    setRevealed(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
      e.preventDefault();
      onDelete();
      close();
    }
  }, [disabled, onDelete, close]);

  // Progress ratios for opacity/scale
  const leftProgress = Math.min(Math.abs(Math.min(offset, 0)) / THRESHOLD, 1);
  const rightProgress = Math.min(Math.max(offset, 0) / THRESHOLD, 1);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-12)]">
      {/* RIGHT-SWIPE action: advance (behind, left side) */}
      {onAdvance && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center"
          style={{
            width: ACTION_WIDTH,
            background: "var(--color-success)",
            opacity: rightProgress,
            transition: swiping.current ? "none" : "opacity 0.2s ease-out",
          }}
        >
          <div className="flex flex-col items-center gap-0.5" style={{ color: "var(--color-text-on-color)", transform: `scale(${0.8 + rightProgress * 0.2})`, transition: swiping.current ? "none" : "transform 0.2s ease-out" }}>
            <ChevronRight size={18} />
            <span className="text-[11px]" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{advanceLabel}</span>
          </div>
        </div>
      )}

      {/* LEFT-SWIPE action: delete (behind, right side) */}
      {onDelete && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center"
          style={{
            width: ACTION_WIDTH,
            background: "var(--color-danger)",
            opacity: revealed === "left" ? 1 : leftProgress,
            transition: swiping.current ? "none" : "opacity 0.2s ease-out",
          }}
        >
          <button
            onClick={() => { onDelete(); close(); }}
            className="flex flex-col items-center gap-0.5"
            style={{ color: "var(--color-text-on-color)", transform: `scale(${0.8 + leftProgress * 0.2})`, transition: swiping.current ? "none" : "transform 0.2s ease-out" }}
            aria-label="Delete"
          >
            <Trash2 size={16} />
            <span className="text-[11px]" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{deleteLabel}</span>
          </button>
        </div>
      )}

      {/* Content layer */}
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={ariaLabel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={revealed ? close : undefined}
        onKeyDown={handleKeyDown}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? "none" : "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
