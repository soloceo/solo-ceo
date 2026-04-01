# Changelog

All notable changes to Solo CEO are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [2.15.0] - 2026-04-01

### Added
- **Tax breakdown display everywhere** — all milestone amounts, transaction rows, mark-paid confirmation, and edit-paid panel now show pre-tax + tax + total when tax is configured
- **Paid milestone amount editing** — click a paid milestone to edit amount, date, and payment method without undo/redo; amount changes cascade to linked finance transaction with automatic tax recalculation
- **Edit-paid panel** — replaces inline editing with a dedicated popup panel (date, amount, payment method, undo)

### Fixed
- **12 finance calculation issues** (P0/P1/P2) — full audit of all money calculations across all pages
- **Subscription billing timing bug** — future-dated subscriptions no longer marked as "已完成" before billing date arrives
- **Project-level tax inheritance** — milestones and mark-paid now read tax settings from the project (not client), fixing cases where project has tax but client doesn't
- **Source-lock bypass** — milestone paid_date/amount edits cascade directly to linked finance_transaction without hitting the source-lock guard
- **Mark-paid API** — both online and offline handlers now check project-level tax_mode/tax_rate before falling back to client-level
- **i18n** — added 6 new keys for tax labels (taxExclusive, taxInclusive, editPaid, amountPreTax, amountInclTax, inclTax) in zh + en

## [2.14.1] - 2026-04-01

### Changed
- **Widgets: all 4 enabled by default** — countdown widget now enabled on first install (migration v9 forces enable for existing users)

## [2.14.0] - 2026-04-01

### Added
- **Client panel UI overhaul** — master-level redesign with underline tabs, card selectors for billing type / status / payment method, unified `radius-12` design language
- **Client panel: project tab** — added project name field, balanced 2×2 grid layout (name + fee, start + end dates)
- **i18n: 4 new keys** — billing type and status hint text (zh + en)

### Fixed
- **Code audit: 15 issues resolved across Critical → Low severity**
  - **Offline api.ts validation** — added `str()` / `enumVal()` to all POST/PUT fields, matching supabase-api.ts (prevents data corruption)
  - **Subscription ledger sync** — preserves `status='已完成'` on existing transactions (prevents confirmed receipt overwrite)
  - **Milestone mark-paid** — offline path now writes `source: 'milestone'` to finance transaction (prevents source lock bypass)
  - **Milestone undo-paid** — added complete `/api/milestones/:id/undo-paid` route to offline api.ts
  - **Frontend diff-only PUT** — TaskDetail + LeadsBoard now compute diff and only send changed fields (prevents stale-data overwrites)
  - **Project PUT validation** — added `enumVal()` for `status` and `tax_mode` in supabase-api.ts
  - **Missing offline route** — added `/api/server-info` to api.ts
- **Type safety fixes**
  - `supabase-api.ts` — removed unsafe `as unknown as` double assertion for OverdueMilestoneRow
  - `main.tsx` — replaced `Record<string, any>` with proper Capacitor interface
  - `i18n/context.tsx` — removed unnecessary `requestIdleCallback` type assertion
- **AnimatePresence + createPortal** — replaced Fragment `<>` with keyed `motion.div` wrapper (Pattern A) in 5 files, enabling proper exit animations
- **Safe-area pattern** — wrapped fallback `env(safe-area-inset-top)` with `max()` in ClientList, LeadsBoard, TaskDetail
- **z-index** — sidebar changed from hardcoded `10` to `var(--layer-nav)`

### Changed
- **Sync manager** — `existingMap` type upgraded from `Map<string, number>` to `Map<string, { id: number; status: string }>` for status-aware ledger sync

## [2.13.1] - 2026-03-31

### Fixed
- **Offline api.ts — 6 PUT endpoints full overwrite → partial update** (CRITICAL data loss prevention)
  - Tasks PUT: dragging column offline no longer blanks title, AI fields, scope
  - Leads PUT: moving stage offline no longer blanks aiDraft, needs, website
  - Clients PUT: editing one field offline no longer resets all 20 fields
  - Finance PUT: editing amount offline no longer resets category, description, tax
  - Plans PUT: editing price offline no longer blanks features array
  - Milestones PUT: editing status offline no longer resets label, amount, dates
- **4 remaining raw `fetch('/api/...')` calls → `api.ts` utility** (BUSINESS_RULES Rule 9)
  - SettingsPage: 3 calls (save name, save avatar, clear avatar)
  - AppearanceSection: 1 call (server time sync check) — also fixed `.json()` on already-parsed response

### Changed
- **BUSINESS_RULES.md** expanded from 12 → 17 rules (added Rules 13–17: frontend PUT discipline, memo interaction pattern, safe-area insets, z-index layers, weekly report filtering)

### Removed
- `.claude/COWORK-RULES.md` (unused)
- `.claude/plans/optimization.md` (outdated — referenced Capacitor, @hello-pangea/dnd, old file paths)
- `.claude/plans/buzzing-booping-llama-agent-*.md` (outdated animation plan — most items already implemented)

## [2.13.0] - 2026-03-31

### Fixed
- **Leads PUT full overwrite** → partial update pattern (prevents wiping aiDraft on edit)
- **Finance PUT full overwrite** → partial update pattern (prevents wiping fields on partial edit)
- **Plans PUT full overwrite** → partial update pattern (prevents wiping features)
- **7 frontend PUT calls sending full objects** → only send changed fields (WorkPage drag/move/priority/due, WorkMemoList toggle/edit, LeadsBoard drag/move)
- **Mobile kanban personal tab unreachable** → workTab check renders WorkMemoList when "个人" selected
- **Client PUT log referencing undefined `name`** → use `body.name`
- **WorkMemoList useMemo missing `scope` dependency** → added to dependency array
- **Weekly report `tasksCompleted` counting all-time** → filtered by `updated_at` within week range
- **useAppSettings using raw `fetch()`** → migrated to `api.ts` utility (BUSINESS_RULES Rule 9)
- **InlinePopover z-index using toasts layer (800)** → corrected to popover layer (600)

### Changed
- **Task/Memo layout separation**: memo section now renders above kanban with clear divider, task controls grouped below
- **Memo item interaction (Google Tasks style)**: removed tiny edit/delete icon buttons; tap row → inline edit mode with title/date/time + save/cancel/delete; tap circle → toggle done
- **Checkbox tap target**: increased from 28px to 44px with negative margins for mobile usability
- **PopoverOption touch target**: `py-2` → `py-2.5` (~37px → ~41px)
- **safe-area-inset-bottom**: applied to `.pb-safe`, mobile bottom nav, and BottomSheet for iPhone home indicator

## [2.12.0] - 2026-03-31

### Added
- Pull-to-refresh on ClientListPage and LeadsPage via event bridge pattern
- `searchTimerRef` useRef-based debounce for search inputs (replaces global `window.__searchT` pattern)

### Changed
- `evolution-knowledge.ts` (53KB) lazy-loaded via dynamic `import()` — now a separate chunk, no longer in main bundle
- InlinePopover: added `active` flag guard to prevent listener registration after effect cleanup (10ms race fix)
- Search debounce in ClientList and FinancePage migrated from `window.__cliSearchT`/`window.__finSearchT` to local `useRef`
- Removed Window interface extension for debounce timers in `vite-env.d.ts`

### Removed
- `@rollup/rollup-linux-arm64-gnu` dependency (platform-specific, unused on macOS)

## [2.11.0] - 2026-03-31

### Added
- Shared API client utility (`src/lib/api.ts`) with typed `get/post/put/patch/del` methods and `ApiError` class
- RLS migration `001_split_rls_policies.sql`: per-operation policies (SELECT/INSERT/UPDATE/DELETE) for all 12 tables
- RLS migration `002_soft_delete_rls_guard.sql`: automatic `soft_deleted = false` filter on SELECT for 8 tables
- Cross-table RLS validation: `payment_milestones` INSERT/UPDATE verifies `client_id` belongs to current user
- Window type declarations for debounce timers (`__cliSearchT`, `__finSearchT`)
- 14 new unit tests (format, cn, api client) — total: 6 files, 57 tests
- Rollback safety net for milestone creation (deletes milestone if finance tx fails)
- `destroySyncManager()` cleanup function with proper auth subscription disposal

### Changed
- **TypeScript `any` eliminated**: 653 → 5 justified instances across 50+ files
  - i18n `TKey` widened to `KnownKey | (string & {})` — removes 580 `as any` casts
  - `TabId` exported from `useUIStore` — removes `setActiveTab("x" as any)` pattern
  - 20+ new interfaces in LeadsBoard, supabase-api, TransactionList, WorkPage, FinancePage
  - All `[key: string]: any` index signatures → `[key: string]: unknown`
- **Empty catch blocks**: 30 of 78 now log `console.warn('[Module]', e)` for debugging
- `validate.ts`: `str()` and `enumVal()` emit dev-mode warnings on truncation/fallback
- Supabase fetch timeout: auth endpoints 8s → 15s; data endpoints remain 8s
- Offline queue: 409/429 now treated as retryable (was permanent failure); user notified on permanent failures via `sync-status` event
- All Framer Motion animations switched from cubic-bezier to `spring(stiffness: 320, damping: 30)`

### Fixed
- InlinePopover trigger: `<div onClick>` → `<button>` with `aria-haspopup`, `aria-expanded`, keyboard accessible
- PopoverOption: added `role="option"`, `aria-selected`, checkmark `aria-hidden`
- Popover panel: added `role="listbox"`
- Toast action button: added `aria-label`
- Avatar fallback alt text: empty string → `"User avatar"`
- Mark-paid flow: returns error instead of silently ignoring finance tx creation failure
- `requestIdleCallback` properly typed (was `Record<string, any>`)

## [2.10.0] - 2026-03-31

### Added
- Vitest testing infrastructure with 35 unit tests covering tax calculation, input validation, and date utilities
- `src/lib/validate.ts` — shared input validation helpers (`str`, `enumVal`) extracted for testability
- Test scripts: `npm test` and `npm run test:watch`

### Changed
- HomePage split from 1000 → 424 lines (extracted KnowledgeBaseSection, ProtocolSection, BreakthroughSection)
- ClientList: extracted `useMilestones` hook (190 lines) and `useClientTransactions` hook (165 lines)
- LeadsBoard: extracted `useLeadAI` hook (120 lines) for AI outreach/analysis logic
- CSS z-index replaced with layer variable system (`--layer-nav`, `--layer-overlay`, `--layer-modal`, `--layer-toast`)
- Input validation added to all Supabase API write paths (string truncation + enum whitelisting)

### Fixed
- Potential XSS/injection via unvalidated user input in API layer
- z-index collisions between navigation, overlays, modals, and toasts

## [2.9.0] - 2026-03-31

### Added
- Personal Memo — reusable WorkMemoList with `scope` prop, blue accent for personal, personal-specific AI placeholder
- Theme system placeholder (Coming Soon in settings)

### Changed
- Mobile drag disabled on kanban boards (tasks + leads) — use column-change buttons instead
- Memo buttons enlarged (32x32px) with `onPointerDown` stopPropagation for reliable touch
- Optimistic updates on memo toggle/delete/save/add — no more click delay
- QuickCreateMenu rendered via portal to fix z-index stacking issues
- Sidebar hover improved with neutral gray

### Fixed
- Memo edit button sometimes triggering toggle instead of edit
- QuickCreateMenu being occluded by sticky table headers and content area
- Warm cream color palette restored after neutral gray experiment

## [2.8.0] - 2026-03-31

### Added
- Theme system infrastructure (store + settings toggle, ready for future themes)
- Sidebar framed panel design (rounded corners + border, Apple Notes style)

### Changed
- Unified page background — sidebar and content share same surface color
- Removed grid background pattern for cleaner look
- Root background changed from white to warm cream (#faf9f5)
- Sidebar hover improved with neutral gray (`rgba(128,128,128,0.1)`)
- Page padding unified across all 6 pages (`p-4 md:p-6 lg:p-8`)
- Settings page width matched to other pages (`max-w-[1680px]`)

### Removed
- Content panel frame (border-radius + shadow) — pages now sit directly on background
- Grid line background pattern

## [2.7.0] - 2026-03-31

### Added
- **Work Memo** — calendar week strip with date/time support, AI quick-add (Gemini/OpenAI/Claude/DeepSeek), inline edit, toggle done
- **Custom 24h TimePicker** — two-dropdown component replacing unreliable native `<input type="time">`
- **iOS 26 motion system** — all animations migrated to Liquid Glass easing curves (`--ease-ios`, `--ease-ios-bounce`, `--ease-ios-glass`)
- **Liquid Glass material** — light glass on mobile nav, glass blur on overlays, glass FAB menu
- **CSS animation utilities** — `anim-appear`, `anim-fade`, `anim-collapse` for mount/unmount transitions
- **Toast exit animation** — AnimatePresence with spring-from-source effect

### Changed
- **DnD library migration** — replaced `@hello-pangea/dnd` with `@dnd-kit/core` + `@dnd-kit/sortable` (React 19 compatible, zero warnings)
- **Responsive kanban** — auto-size columns on desktop (lg:), horizontal scroll on mobile
- **Page padding unified** — all pages now use consistent `p-4 md:p-6 lg:p-8`
- **Settings page width** — matched to other pages (`max-w-[1680px]`)
- **Skeleton loading** — reduced from 600ms to 250ms total
- **Press feedback** — updated to iOS 26 scale(0.96) with 200ms ease

### Fixed
- Kanban overflow bleeding into personal tab panel
- Chinese IME Enter key triggering premature form submission
- Gemini AI memo model name (gemini-2.0-flash → gemini-2.5-flash)
- FinancePage duplicate motion import crash
- 9 empty `.catch(() => {})` blocks → proper error logging

### Removed
- `@hello-pangea/dnd` dependency (replaced by @dnd-kit)
- `@google/genai` dependency (unused, -200KB)
- 7 unused CSS classes (`.kanban-scroll`, `.modal-backdrop`, `.page-title`, `.page-wrap`, `.list-item`, `.anim-pop`, `.celebrate-bounce`)
- 3 unused CSS variables (`--color-info-light`, `--spring-bounce`)

## [2.6.0] - 2026-03-30

### Added
- Work Memo feature (initial version)
- Kanban responsive layout
- IME composition fix

## [2.5.0] - 2026-03-30

### Fixed
- Security audit fixes
- Touch UX improvements
- InlinePopover mobile fix
