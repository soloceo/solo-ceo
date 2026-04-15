/**
 * celebrate() — fire-and-forget celebration animations for reward moments.
 *
 * Uses canvas-confetti via dynamic import so it stays out of the main bundle
 * until a celebration actually triggers. Respects prefers-reduced-motion.
 */

export type CelebrateKind = "won" | "milestone" | "streak";

const PALETTES: Record<CelebrateKind, string[]> = {
  // Sales win — success green + warm gold + white for contrast on both themes
  won: ["#22c55e", "#10b981", "#fbbf24", "#f59e0b", "#ffffff"],
  // Revenue / goal milestone — gold-forward, premium feel
  milestone: ["#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
  // Streak (Daily Protocol) — flame gradient
  streak: ["#fb923c", "#f97316", "#ef4444", "#fde047"],
};

type ConfettiFn = typeof import("canvas-confetti");
let cached: ConfettiFn | null = null;

async function loadConfetti(): Promise<ConfettiFn> {
  if (cached) return cached;
  const mod = await import("canvas-confetti");
  // canvas-confetti exports the function as the module's default-interop export
  cached = (mod as unknown as { default: ConfettiFn }).default ?? (mod as unknown as ConfettiFn);
  return cached;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fire a celebration burst. Safe to await or fire-and-forget.
 * No-op on SSR or if the user prefers reduced motion.
 */
export async function celebrate(kind: CelebrateKind = "won"): Promise<void> {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  try {
    const confetti = await loadConfetti();
    const colors = PALETTES[kind];
    const base = { spread: 70, ticks: 200, zIndex: 9999, colors, disableForReducedMotion: true };

    // Two-cannon burst — side-shooting inward for a planned, professional feel
    confetti({ ...base, particleCount: 80, origin: { x: 0.15, y: 0.75 }, angle: 60, startVelocity: 55 });
    confetti({ ...base, particleCount: 80, origin: { x: 0.85, y: 0.75 }, angle: 120, startVelocity: 55 });

    // Small trailing puff from center after a beat — adds rhythm, prevents "single-shot" feel
    setTimeout(() => {
      confetti({ ...base, particleCount: 30, origin: { x: 0.5, y: 0.85 }, angle: 90, startVelocity: 40, spread: 100 });
    }, 150);
  } catch {
    // Confetti is decorative — never break the happy path because of it
  }
}
