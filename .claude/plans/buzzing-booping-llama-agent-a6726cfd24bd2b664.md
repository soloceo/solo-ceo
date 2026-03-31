# Animation Improvement Plan — Solo CEO

## Summary

The app currently feels "choppy/flashy" because content appears/disappears instantly. The fix is 13 targeted changes across 7 files, split into three tiers: CSS utility classes (zero JS cost), component-level CSS enhancements, and surgical framer-motion additions only where exit animations are needed.

**Existing design tokens:**
- `--transition-fast: 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)` (ease-out-quad)
- `--spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)`
- `--ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Spring spec: damping 30, stiffness 320

**Principles:**
- CSS-first: prefer `@starting-style` + `transition` over framer-motion imports
- 150-250ms range for all new animations (fast, not fancy)
- No animation on virtualized/virtual-scroll lists (Finance VirtualTxList)
- No new framer-motion imports in files that don't already use it (except Toast)

---

## TIER 1: CSS Foundation (3 changes, highest impact, zero JS)

### Change 1: Add CSS utility animation classes
**File:** `src/styles/animations.css`
**Type:** CSS only

Add three new utility classes after the existing `.animate-fade-in`:

```css
.anim-appear {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  @starting-style {
    opacity: 0;
    transform: translateY(6px);
  }
}

.anim-fade {
  opacity: 1;
  transition: opacity 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  @starting-style {
    opacity: 0;
  }
}

.anim-pop {
  opacity: 1;
  transform: scale(1);
  transition: opacity 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  @starting-style {
    opacity: 0;
    transform: scale(0.92);
  }
}

.anim-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.anim-collapse[data-collapsed="true"] {
  grid-template-rows: 0fr;
}
.anim-collapse > * {
  overflow: hidden;
}

.task-done-text {
  transition: color 200ms var(--ease-out-quad),
              text-decoration-color 200ms var(--ease-out-quad);
}
```

**Rationale:** `@starting-style` is supported in Chrome 117+, Safari 17.5+, Firefox 129+. Elements simply appear instantly in unsupported browsers (progressive enhancement, zero risk). Duration: 150-200ms. Easing matches existing tokens.

---

### Change 2: Improve page-enter animation
**File:** `src/styles/animations.css`
**Type:** CSS only

**Current** (line 44-51):
```css
@keyframes page-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.page-enter {
  animation: page-enter 80ms ease-out both;
}
```

**Replace with:**
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: page-enter 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}
```

**Rationale:** The 80ms opacity-only flash is too fast to perceive, creating a jarring effect. 150ms with a 4px vertical shift gives the eye something to track. This affects every tab switch via the `Content` component in `src/app/App.tsx` line 93.

---

### Change 3: Improve skeleton-in transition
**File:** `src/styles/animations.css`
**Type:** CSS only

**Current** (line 34-36):
```css
.animate-skeleton-in {
  animation: skeleton-in 0.3s ease-out 0.3s both;
}
```

**Replace with:**
```css
.animate-skeleton-in {
  animation: skeleton-in 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s both;
}
```

**Rationale:** Reduces total skeleton-to-content time from 600ms to 250ms. The 100ms delay still prevents flash when data loads instantly.

---

## TIER 2: Component-Level List Animations (5 changes)

### Change 4: Animate personal task list items
**File:** `src/features/work/PersonalTaskList.tsx`
**Type:** Add CSS class (no new imports)

At line 163, change:
```jsx
<div key={task.id}>
```
to:
```jsx
<div key={task.id} className="anim-appear">
```

At line ~202, add `anim-appear` to child task rows:
```jsx
<div key={child.id} className="flex items-center gap-3 pl-10 pr-3 py-2 ... anim-appear">
```

Also add `task-done-text` class to the task title spans (lines ~181, ~211) that have `textDecoration: line-through` styles, so completion strikethrough animates smoothly.

---

### Change 5: Animate work memo list items
**File:** `src/features/work/WorkMemoList.tsx`
**Type:** Add CSS class (no new imports)

Add `anim-appear` to each memo row div in the list rendering section (~line 380+).

Additionally, replace the collapse conditional render `{!collapsed && (...)}` (line 325) with the CSS collapse pattern:
```jsx
<div className="anim-collapse" data-collapsed={collapsed}>
  <div>
    <div className="card overflow-hidden">
      {/* existing content */}
    </div>
  </div>
</div>
```

This gives smooth height animation on collapse/expand instead of instant show/hide.

---

### Change 6: Animate stat cards
**File:** `src/features/finance/TransactionList.tsx`
**Type:** Add CSS class

At line 25, change:
```jsx
<div className="stat-card">
```
to:
```jsx
<div className="stat-card anim-appear">
```

Only 4 stat cards render, zero performance concern.

---

### Change 7: View mode fade on WorkPage
**File:** `src/features/work/WorkPage.tsx`
**Type:** Add CSS class (no new imports)

When toggling between Kanban/Swimlane view modes, wrap the content area in a keyed fade:
```jsx
<div key={viewMode} className="anim-fade flex-1 overflow-hidden">
  {viewMode === "kanban" ? <KanbanBoard ... /> : <SwimlaneView ... />}
</div>
```

The `key` prop forces React to remount, triggering the `@starting-style` fade. Duration: 150ms.

---

### Change 8: Client list non-virtualized elements
**File:** `src/features/clients/ClientList.tsx`
**Type:** Add CSS class

Add `anim-appear` to stat summary cards and filter bar at the top of the page. Do NOT add to virtualized rows (they use `useVirtualizer` from `@tanstack/react-virtual` and would re-trigger on scroll).

---

## TIER 3: Framer-Motion Exit Animations (5 changes)

### Change 9: Toast enter/exit with AnimatePresence
**File:** `src/components/ui/Toast.tsx`
**Type:** framer-motion (new import to this file)

**Current:** Uses `if (!toastMessage) return null;` (instant unmount, no exit).

**Replace with:**
```tsx
import { motion, AnimatePresence } from "motion/react";

export function GlobalToast() {
  const toastMessage = useUIStore((s) => s.toastMessage);
  // ... other hooks ...

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          key="global-toast"
          role="status"
          aria-live="polite"
          className="fixed right-4 md:right-6 px-4 py-2 rounded-full flex items-center gap-2 text-[15px]"
          style={{ /* same existing inline styles, remove animate-fade-in class */ }}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* existing Check icon + message + action button */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Duration:** 200ms enter, 200ms exit
**Easing:** ease-out-quad
**Rationale:** The toast is the single most visible "flash" in the app. Adding exit animation is the highest-impact single change.

---

### Change 10: Mobile tab indicator with layoutId
**File:** `src/app/App.tsx`
**Type:** framer-motion (already imported in this file)

Find the `MobileNavItem` component and add a `layoutId` animated pill background:

```jsx
function MobileNavItem({ id, icon, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className="relative flex-1 flex flex-col items-center justify-center py-2 transition-colors"
      style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}
    >
      {active && (
        <motion.div
          layoutId="mobile-tab-pill"
          className="absolute inset-1 rounded-[var(--radius-12)]"
          style={{ background: "var(--color-bg-tertiary)" }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-[10px] mt-0.5" style={{ fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </button>
  );
}
```

**Spring:** damping 30, stiffness 320 (design system spec)
**Rationale:** This is the signature animation that transforms tab switching from "flashy" to "fluid." The `layoutId` causes the background pill to smoothly slide between tabs. App.tsx already imports motion. This is the single most impactful change for the core complaint.

---

### Change 11: Confirmation dialog enter/exit
**File:** `src/features/work/PersonalTaskList.tsx`
**Type:** framer-motion (new import)

The delete confirmation at line 264 uses `animate-fade-in` with no exit. Wrap in AnimatePresence:

```jsx
import { motion, AnimatePresence } from "motion/react";

// In the render, replace the existing confirmation portal:
{createPortal(
  <AnimatePresence>
    {confirmDeleteId !== null && (
      <motion.div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 710, background: "var(--color-overlay-primary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="..." /* existing card styles */
        >
          {/* existing dialog content */}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>,
  document.body
)}
```

**Duration:** 150ms
**Apply same pattern to:** `src/features/clients/LeadsBoard.tsx` (lines 481, 495) and `src/features/finance/FinancePage.tsx` (line 727).

---

## Implementation Order

| # | Change | Impact | Risk | Est. Time |
|---|--------|--------|------|-----------|
| 1 | CSS utility classes (animations.css) | Foundation | None | 5 min |
| 2 | Page-enter improvement (animations.css) | High | None | 2 min |
| 3 | Mobile tab indicator (App.tsx) | Very High | Low | 15 min |
| 4 | Toast enter/exit (Toast.tsx) | High | Low | 10 min |
| 5 | Skeleton timing (animations.css) | Medium | None | 2 min |
| 6 | Personal task items (PersonalTaskList.tsx) | Medium | None | 5 min |
| 7 | Work memo items + collapse (WorkMemoList.tsx) | Medium | Low | 10 min |
| 8 | Task completion transition (animations.css) | Medium | None | 2 min |
| 9 | Stat cards (TransactionList.tsx) | Low-Med | None | 2 min |
| 10 | View mode fade (WorkPage.tsx) | Low-Med | None | 5 min |
| 11 | Client list elements (ClientList.tsx) | Low | None | 5 min |
| 12 | Confirmation dialogs (PersonalTaskList + others) | Low-Med | Low | 10 min |

**Total: ~73 minutes**

---

## What NOT to animate

1. **VirtualTxList** in Finance — virtualized rows recycle
2. **Kanban drag-and-drop** — @hello-pangea/dnd handles its own animations
3. **Swipe tab scroll** — CSS scroll-snap already smooth
4. **Desktop sidebar** — already has `transition-[width] duration-200`
5. **Large lists > 20 items** — skip stagger, use simple fade only
