# Changelog

All notable changes to Solo CEO are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

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
