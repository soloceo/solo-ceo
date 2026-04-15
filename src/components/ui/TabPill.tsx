import { motion } from "motion/react";

/**
 * Animated background pill for `.page-tabs` segmented controls.
 * Drop this INSIDE the active `<button>`, and give the parent `<div>`
 * the `data-motion-pill` attribute — see `.page-tabs[data-motion-pill]`
 * rules in components.css which suppress the CSS-only active background.
 *
 * `groupId` scopes the shared layout so pills don't jump between unrelated
 * tab groups on the same page.
 */
export function TabPill({ groupId }: { groupId: string }) {
  return (
    <motion.span
      layoutId={`tab-pill-${groupId}`}
      aria-hidden="true"
      className="tab-pill-motion absolute inset-0 rounded-[var(--tab-radius)]"
      style={{
        background: "var(--tab-active-bg)",
        border: "var(--border-width) solid var(--tab-active-border)",
        // Sits behind the button's content (icons + text nodes). The button itself
        // has `isolation: isolate` so -1 doesn't leak behind ancestors.
        zIndex: -1,
      }}
      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
    />
  );
}
