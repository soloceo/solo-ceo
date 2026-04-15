/**
 * Global pointer-driven premium effects. Runs ONE pointermove listener on the
 * window and updates CSS custom properties on the element currently under the
 * cursor. CSS does the actual visual work (GPU-composited), keeping JS cheap.
 *
 * Effects keyed by class:
 *   .card-interactive, .card-glow, .stat-card, .widget-card, .nav-glow,
 *   .sidebar-glass — sets `--mx` / `--my` (0-100%) while hovered
 *                    (radial spotlight gradient + border glow)
 *
 * Guards:
 *   • `(prefers-reduced-motion: reduce)` — effects disabled entirely
 *   • `(hover: hover)` — skipped on touch devices (no hover state to react to)
 */

let initialized = false;
let rafId: number | null = null;
let lx = 0;
let ly = 0;
let prevSpot: HTMLElement | null = null;

const SPOTLIGHT_SEL = ".card-interactive, .card-glow, .stat-card, .widget-card, .nav-glow, .sidebar-glass";

export function initMouseEffects(): void {
  if (initialized || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return;
  initialized = true;

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("blur", onLeave);
  document.addEventListener("visibilitychange", onLeave);
}

function onMove(e: PointerEvent) {
  lx = e.clientX;
  ly = e.clientY;
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}

function onLeave() {
  if (prevSpot) { clearSpot(prevSpot); prevSpot = null; }
}

function tick() {
  rafId = null;

  const stack = document.elementsFromPoint(lx, ly);
  let spot: HTMLElement | null = null;
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.matches(SPOTLIGHT_SEL)) { spot = el; break; }
  }

  if (prevSpot !== spot) {
    if (prevSpot) clearSpot(prevSpot);
    prevSpot = spot;
  }
  if (spot) applySpot(spot);
}

function applySpot(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const px = ((lx - r.left) / r.width) * 100;
  const py = ((ly - r.top) / r.height) * 100;
  el.style.setProperty("--mx", `${px}%`);
  el.style.setProperty("--my", `${py}%`);
}
function clearSpot(el: HTMLElement) {
  el.style.removeProperty("--mx");
  el.style.removeProperty("--my");
}
