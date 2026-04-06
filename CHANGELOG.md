# Changelog

All notable changes to Solo CEO are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [2.29.3] - 2026-04-06

### Fixed
- **RLS user_id filtering** — add missing `.eq('user_id')` to milestone cascade delete and subscription ledger batch operations in supabase-api.ts, preventing potential cross-user data access
- **SWR stale write rejection** — version-based cache prevents background revalidation from overwriting fresh optimistic data in data-cache.ts
- **Agent seed infinite loop** — remove `agents.length` from useEffect deps that mutates agents; add session-level + localStorage dedup guard
- **Agent delete rollback** — restore previous agent list on failed API delete instead of leaving stale UI
- **Offline queue ordering** — POSTs now run sequentially before PUT/DELETE batches, preventing "update before create" failures on replay
- **Dashboard offline parity** — add 6 missing fields (todoCount, inProgressCount, leadsNew, leadsContacted, leadsProposal, todayIncome) and switch mrrSeries to finance_transactions source
- **Finance source field** — POST /api/finance now persists `source` and `source_id`; added `client_name` to GET response
- **Currency in AI prompts** — pass user's currency setting (CAD/USD/CNY) to AI chat and Agent test panel system prompts instead of hardcoded ¥
- **useRealtimeRefresh stability** — replace useCallback with useRef pattern to prevent effect re-runs on callback identity change
- **Cross-tab theme sync** — useUIStore now listens to localStorage `storage` events for multi-tab consistency
- **CommandPalette i18n** — fix missing translation key for quick-create finance entry

---

## [2.29.2] - 2026-04-05

### Fixed
- **CSP removed** — Content Security Policy meta tag was blocking sql.js WebAssembly and Supabase connections on GitHub Pages; removed entirely to restore offline mode and cloud sync
- **viewport-fit=cover** — enable `env(safe-area-inset-*)` CSS on notched iPhones (was returning 0)
- **AIChatPanel lazy-load** — split from main bundle via React.lazy(); main JS reduced from 843KB to 593KB (-250KB)
- **Google Fonts non-blocking** — moved render-blocking `@import` to async `<link>` with preconnect
- **Touch targets** — TaskCard priority badge and column-change button enlarged to 44px minimum
- **300ms tap delay** — global `touch-action: manipulation` prevents double-tap-to-zoom delay
- **Rule 17 weekly report** — offline tasksCompleted now filters by updated_at within the week
- **Content drafts soft_deleted** — offline GET now excludes soft-deleted drafts

---

## [2.29.1] - 2026-04-05

### Security
- **Content Security Policy** — restrict script/connect/img sources to known domains
- **CSV formula injection** — prefix dangerous leading chars with tab in exports
- **XSS link sanitization** — block `javascript:`/`data:`/`vbscript:` in AI markdown links

### Fixed
- **AI chat avatar overflow** — render profile photo as `<img>` instead of raw base64 text
- **Gemini thinking tokens** — filter `thought: true` parts from streaming output
- **Chat bubble overflow** — `overflow-wrap: break-word` for long strings
- **Offline subtask cascade** — delete subtasks when parent task is soft-deleted
- **Offline milestone finance** — auto-create finance_transaction on milestone creation
- **Import atomicity** — wrap importAllData in SQL transaction with ROLLBACK on failure
- **Finance categories** — expanded to match all AI-generated categories (Chinese + English)
- **Agent seed dedup** — check existing template_id before creating, prevent duplicates
- **Null fallback** — offline PUT tasks uses `|| null` for client_id/parent_id
- **Tax formula** — use `calcTaxOffline()` consistently, fix floating-point divergence
- **Error boundary** — top-level ErrorBoundary catches render crashes with reload button
- **Settings cache** — invalidate useAppSettings after SettingsPage saves
- **Error handling** — add `.catch()` to fire-and-forget API calls in memo components
- **z-index** — replace magic numbers with CSS variables
- **safe-area** — add `env()` fallback `0px` parameter
- **HomePage re-renders** — add Zustand selector to useSettingsStore
- **Soft delete filter** — offline dashboard manual focus query
- **Streaming cleanup** — abort controller on AIChatPanel unmount

---

## [2.29.0] - 2026-04-05

### Added
- **AI Agent system** — custom AI agents with persona, rules, tools, and starter prompts; full CRUD via Settings
- **Agent templates** — 4 built-in agents (默认助手, 任务管家, 销售助手, 财务管家) with specialized tool access
- **AI multi-conversation management** — create, switch, rename, delete conversations; per-agent conversation history
- **AI conversation cloud sync** — conversations persist to Supabase with realtime sync across devices
- **Transaction scope selector** — business/personal toggle on AI record_transaction confirmation card
- **Web search tool** — AI can search the internet via Gemini Search Grounding
- **Agent test panel** — test agent prompts directly from Settings before deploying

### Fixed
- **AI one-turn lag** — AI was answering the previous question due to React 18 batching; fixed ref synchronization
- **Copy button in AI chat** — added `document.execCommand` fallback for non-HTTPS environments
- **Currency showing ¥** — demo defaults corrected to USD; existing installs fixed
- **AI system prompt context** — now includes businessLocation so AI understands user's market
- **English AI reinforcement prompt** — removed misleading "don't analyze data" instruction

### Changed
- **North American defaults** — all seed data, demo profile, placeholders, and lead sources target Chinese-Canadian designers in North America (Toronto) instead of mainland China
- **USD pricing** — plans at $499/$1,500/$2,500; realistic North American freelancer expense amounts
- **North American lead sources** — Instagram DM, LinkedIn, Google, Networking instead of 小红书/即刻
- **Breakthrough tasks** — social media tasks reference Instagram/LinkedIn instead of 小红书/微信
- **Default agent selection** — 默认助手 is now the default when opening AI Chat; conversation icons show 🤖

---

## [2.28.1] - 2026-04-05

### Fixed
- **Profile fields not editable** — `getState()` replaced with hook subscriptions so typing triggers re-renders
- **AI Chat panel width** — desktop drawer widened from 400px to 50% viewport for better readability

---

## [2.28.0] - 2026-04-05

### Added
- **Complete profile fields** — business email, phone, title, company, website, location with full Supabase sync
- **PROFILE_SYNC_KEYS mapping** — generic profile field system for automatic cloud sync on login
- **Bilingual expense categories** — 8 business + 8 personal categories in both Chinese and English

### Enhanced
- **AI Chat system prompt** — richer business context injection (title + company + description), 20-item page context, aggregate stats per tab
- **AI parsing prompts** — few-shot examples for bookkeeping, task creation, and task breakdown; bilingual prompt support
- **Lead AI analysis** — scoring and outreach now reference user's actual business description
- **Backup/restore** — exports and imports all 9 profile fields

### Changed
- **Profile section redesign** — removed gradient hero, inline avatar with name on single row, clean single-column form layout
- **Income detection** — handles both Chinese and English category names

### Fixed
- **English income categorization** — `parsed.category === "Income"` check added alongside Chinese `"收入"`

---

## [2.27.1] - 2026-04-05

### Fixed
- **Currency symbol** — AI Chat system prompt and demo seed data used ¥ instead of $ (app default is USD)

### Docs
- **README** — rewritten with theme system section, AI Chat module, updated tech stack
- **LICENSE** — cleaner language, added SaaS restriction clause

---

## [2.27.0] - 2026-04-05

### Added
- **Google Workspace palette** — authentic Google hex codes (#1a73e8 accent, #dadce0 borders), dark mode pastels (#8ab4f8), production shadow formula (rgba(60,64,67,...))
- **Material Design 3 style** — borderless elevation, MD3 shape scale (12dp radius), 3-level shadow system, pill tabs, 0.1px letter-spacing, 32% scrim
- **Material preview card** — style picker shows pill-shaped button + chip row for Material
- **AI Chat theme adaptation** — all 4 styles (Neobrutalism, Material, Glassmorphism, HUD) now style the AI Chat panel, message bubbles, quick prompts, and send button

### Fixed
- **Login input icon overlap** — Material focus style no longer overrides padding-left (uses outline instead of border-width)
- **Neobrutalism mobile nav** — header pill, menu button, and bottom nav stay round instead of square
- **TodayFocus badge colors** — "系统" badge now uses purple (was same blue as "交付")

---

## [2.26.3] - 2026-04-04

### Improved
- **AI Chat Panel layout** — desktop: right-side 400px rounded drawer with backdrop overlay, slide-in from right; mobile: true fullscreen with safe-area top padding, no page content bleed-through

---

## [2.26.2] - 2026-04-04

### Changed
- Navigation tab order: Leads now appears before Tasks across all surfaces (sidebar, mobile nav, command palette, quick-create menus, keyboard shortcuts 2↔3)

---

## [2.26.1] - 2026-04-04

### Enhanced
- **AI Chat — Markdown rendering** — assistant responses now render with formatted lists, bold, code blocks, links, and blockquotes via `react-markdown`
- **AI Chat — Quick prompt suggestions** — empty state shows 4 clickable prompts based on the current page (e.g., "业务总览", "逾期任务", page-specific analysis)
- **AI Chat — Page-aware context** — chat automatically injects current page data (tasks/leads/clients/transactions) into system prompt for more relevant answers
- **AI Chat — Copy button** — hover over any assistant message to copy its content
- **AI Chat — Textarea auto-resize** — input grows with content up to 120px max height
- **AI Chat — No-provider state** — when no AI is configured, shows a "去设置" button that navigates directly to Settings page

---

## [2.26.0] - 2026-04-04

### Added
- **AI Chat Panel** — floating chat button opens a slide-up conversation panel with streaming AI responses
  - Business context injection: automatically loads dashboard data (MRR, clients, tasks, leads) into system prompt
  - Streaming responses with real-time token display (SSE)
  - Supports all connected providers: Ollama, OpenAI, Claude, Gemini, DeepSeek
  - Conversation history (last 10 messages) for multi-turn context
  - No persistence — chat clears on close for privacy
  - Spring animation entry/exit, mobile safe-area support

---

## [2.25.1] - 2026-04-04

### Fixed
- AI provider buttons now show "Connect / Disconnect" toggle instead of "Select / Active"
- Disconnecting AI now fully disables all AI features — previously fell back to cloud settings due to localStorage removal instead of explicit "off" sentinel

---

## [2.25.0] - 2026-04-04

### Added
- **Ollama 本地模型支持** — 在设置页可选择 Ollama 作为 AI 提供商，连接本地运行的大语言模型（如 Gemma 4）
  - 自动发现已安装模型（`GET /api/tags`），下拉选择
  - 服务地址可配置（默认 `http://localhost:11434`）
  - 使用 OpenAI 兼容接口，零额外依赖
  - 所有 AI 功能均支持：支出解析、任务拆解、线索分析、邮件生成、备忘录解析
- **设备级 AI 选择** — `ai_provider` 改为 localStorage 存储，每台设备可独立选择 AI 提供商（电脑用本地模型，手机用云端 API）
- **`getAIConfig` 统一配置读取** — 所有 AI 消费者统一通过 `getAIConfig()` 获取配置，消除重复代码
- **`extractJSON` 容错解析** — 本地模型 JSON 输出不稳定时，自动提取 `{...}` 块再解析

---

## [2.24.2] - 2026-04-03

### Performance
- **SWR cache layer** — cached GET responses for instant tab switching; background revalidation keeps data fresh
- **Parallel data loading** — WorkPage, FinancePage, ClientList now load via `Promise.all` instead of sequential fetches
- **Select column pruning** — all 11 `select('*')` replaced with specific columns, reducing payload size
- **Subscription ledger batching** — sequential N+1 updates → parallel waves of 20 (240→12 round trips)
- **Query optimization** — `.like('%应收%')` → `.eq('待收款 (应收)')` for index-friendly status filtering
- **Cold-start timeout** — first Supabase request gets 15s (for DB wake-up), subsequent 8s
- **useCallback stabilization** — `useRef` pattern prevents infinite re-fetch loops in WorkPage/FinancePage

### Fixed
- **Realtime cache coherence** — realtime events now invalidate SWR cache before triggering refetch, preventing stale data
- **FinancePage Promise.allSettled** — was creating promises without awaiting; now properly awaited via `Promise.all`

---

## [2.24.1] - 2026-04-03

### Fixed
- **iOS PWA status bar** — dynamically switch `apple-mobile-web-app-status-bar-style` between `default` (light mode, black text) and `black-translucent` (dark mode, white text) on theme change; takes effect on next app launch

---

## [2.24.0] - 2026-04-03

### Added
- **Interaction animation system** — comprehensive motion upgrade across the entire app for native-feel interactions
  - Page tab transitions (`page-enter` fade+scale on route change)
  - Task completion bounce (`.check-toggle` scale 1.3x + color transition)
  - Dropdown menu spring physics (`.popover-spring` shared class for CommandPalette, QuickCreate, UserMenu)
  - Mobile tab sliding indicator (`layoutId="mobile-tab-indicator"` spring physics)
  - Desktop sidebar sliding indicator (`layoutId="sidebar-indicator"` spring physics)
  - Kanban card reflow animation (`AnimatePresence` + `motion.div layout` with spring 320/30)
  - List item deletion collapse animation (`.anim-collapse-exit` grid-template-rows transition)
  - KPI number count-up animation (extended `useCountUp` to all 4 secondary KPIs)
  - Toast spring entry (`.popover-spring` with scale 0.88 → 1 + translateY)
  - Submit success pulse keyframe (`@keyframes submit-success`)
- **Theme-specific navigation** — per-theme sidebar and mobile nav indicator styling
  - Neobrutalism: hard 2px border + offset shadow indicators, squared corners, translate press feedback
  - Glassmorphism: translucent accent-tinted glass pill, soft inner highlight, 10px rounded corners
  - HUD: accent left-border glow, inset glow shadow, text-shadow glow on active
- **Theme-specific mobile nav** — `.mobile-tab-indicator` CSS hook for per-theme bottom bar indicators
- **Theme deep customization** — filled all missing component overrides:
  - Neobrutalism: modal, toast, FAB menu, mobile header pill, kanban column, widget card
  - Glassmorphism: KPI typography, section labels, button group inline, table cells
  - HUD: modal overlay (dark + blur), card interactive hover glow
- **Theme-specific hover states** — sidebar nav hover effects for glassmorphism (glass tint) and HUD (accent glow + border)

### Changed
- Segment switcher → page-tabs style on WorkPage and LeadsBoard for visual consistency
- `prefers-reduced-motion: reduce` now covers all new animation classes

---

## [2.23.1] - 2026-04-03

### Added
- **Mobile floating capsule header** — replaced full-width header with two floating circular pills: left for identity (avatar + online status dot), right for menu (ellipsis icon → dropdown with user info, cloud status, theme switcher, settings, login)

### Fixed
- **Data layer audit (5× P0)** — offline `db/api.ts` now mirrors `supabase-api.ts` validation: tasks POST/PUT, milestones POST/PUT, and finance PUT all use `str()`/`enumVal()` with correct limits and whitelists
- **Partial update violations (2× P1)** — `TaskDetail` and `LeadsBoard` now skip API calls when diff is empty, preventing full-object overwrites
- **XSS in error handler** — `src/main.tsx` replaced `innerHTML` with DOM API (`createElement` + `textContent`)
- **Unused exports cleanup** — removed dead `Modal`/`BottomSheet` re-exports from `components/ui/index.ts`
- **Z-index hardcodes** — `usePullToRefresh` and HUD card decoration now use `var(--layer-float)` / `var(--layer-base)` tokens

---

## [2.23.0] - 2026-04-03

### Added
- **Space Capsule HUD style** — new "太空舱" option in Style picker: cockpit-grade instrument panel aesthetic with sharp 2px corners, glowing accent-tinted borders, JetBrains Mono monospace headings, and glow-based shadows
- **Corner bracket reticles** — ┌ ┐ └ ┘ targeting markers on all `.card` elements via pure CSS `::after` pseudo-elements (zero JS overhead)
- **Background grid + scan-line sweep** — faint accent-tinted grid pattern with radial fade, plus animated horizontal scan-line bar (8s cycle) for immersive cockpit feel
- **Palette-agnostic glow system** — all HUD effects use `color-mix(in srgb, var(--color-accent) N%, transparent)`, automatically adapting to all 6 palettes (yellow, blue, pink, green, purple, monochrome)
- **Progress bar pulse animation** — `hud-bar-glow` 2s pulse on progress indicators
- **KPI value text glow** — `text-shadow` glow on dashboard numbers in dark mode
- **JetBrains Mono font** — loaded via Google Fonts with `display=swap` for non-blocking rendering; applied to headings, tabs, badges, buttons, and section labels in HUD style
- **HUD preview card** — custom style picker preview with corner bracket indicators, accent glow bar, and monospace label
- **Accessibility** — `prefers-reduced-motion: reduce` disables scan-sweep and bar-glow animations

---

## [2.22.2] - 2026-04-03

### Changed
- **Performance: motion.js removed from critical path** — replaced `AnimatePresence`/`motion.div` with CSS transitions in Toast, UserMenu, QuickCreateMenu, CommandPalette, and FAB menu; motion (96KB) now lazy-loads only when page components need it; main bundle **556→523KB** (-6%)
- **Zustand selector refactor** — App.tsx and CommandPalette.tsx use individual selectors instead of full store destructuring, preventing unnecessary App shell re-renders
- **Spacing density unified** — KPI grid gap 10→12px, secondary card padding 14→12px, TodayFocus subtitle gap 2→4px; eliminated orphan spacing values

### Fixed
- **Mobile nav pill fully opaque on Glassmorphism** — Android WebView renders `backdrop-filter` poorly; nav pill now uses `var(--color-bg-primary)` with no blur, ensuring 100% readability on all devices

---

## [2.22.1] - 2026-04-03

### Changed
- **Remove swipe navigation** — deleted `useSwipeTabs` hook; Finance and Home pages now use `useState` + conditional rendering (simpler, no iOS scroll-snap bugs)
- **Widget grid always draggable** — removed edit-mode gate; widgets are directly draggable via 200ms TouchSensor (no extra tap needed)
- **Finance quick-create** — added business/personal scope toggle inside the form panel so users can switch scope without closing

### Fixed
- **Chart animations restored** — re-enabled `isAnimationActive` and tooltip on mobile (disabled during swipe debugging)
- **8 orphaned CSS classes removed** — `protocol-step/done/current`, `section-header`, `kpi-sub`, `input-error`, `avatar-ring`, `divider`
- **Dead code cleaned** — removed `personal-transaction` unreachable branch, orphaned `widgets.title` i18n key, deprecated `-webkit-overflow-scrolling: touch`

### Removed
- `src/hooks/useSwipeTabs.ts` — no longer used anywhere
- `.home-swipe-container` / `.home-swipe-panel` CSS classes

---

## [2.22.0] - 2026-04-03

### Added
- **Glassmorphism style** — new "Glass" option in Style picker: frosted blur, translucent surfaces, animated color orbs, Apple Liquid Glass-inspired design
- **backdrop-filter: brightness(1.05)** — light mode glass panels gain luminous vibrancy (Apple-aligned)
- **Accessibility: prefers-contrast: more** — glass falls back to solid backgrounds with visible borders
- **Accessibility: prefers-reduced-motion** — disables orb animation and hover transforms
- **Accessibility: prefers-reduced-transparency** — disables all glass effects
- **backdrop-filter fallback** — `@supports not (backdrop-filter)` provides solid fallback for older browsers

### Changed
- **Glass opacity tuned** — light mode glass slightly more transparent (0.58 content, 0.45 panels) for better orb bleed-through
- **Dark mode saturate reduced** — 180% → 140% to prevent garish color halos on dark backgrounds
- **Shadows removed for glass style** — tiny/low/medium shadows set to `none` (both light and dark); depth via blur+translucency, not shadow
- **Grain texture removed** — noise overlay deleted entirely (glass depth via blur, not texture)
- **Inline styles → CSS base classes** — Modal overlay/content, Toast, CommandPalette, mobile nav pill, FAB menu, kanban columns now use CSS classes so `[data-theme]` selectors win without `!important`

### Fixed
- **Theme apply refactored** — single-pass Map-based DOM update instead of clearAll + re-apply; sets `data-theme` attribute for CSS targeting

---

## [2.21.0] - 2026-04-02

### Added
- **Settings cloud sync** — theme, style, palette, widget layout, countdowns, and energy data now sync to Supabase `app_settings` table and restore on new devices
- **Offline `app_settings` API** — GET/POST `/api/settings` routes in sql.js offline layer

### Changed
- **QuickCreate menu simplified** — flat 4-item list (task/lead/client/finance), removed personal items and group headers, items open create forms directly
- **Notion-style page tabs** — `.page-tabs` changed from full-width underline tabs to left-aligned pill buttons
- **Finance page layout** — merged tabs row and actions row into a single line
- **Work page button** — "新建" renamed to "新建任务" for clarity
- **Memo form mobile fix** — date/time inputs now use compact `.inline-form` sizing (36px on mobile vs 48px), date input flexes to fill available width, all controls on one row

---

## [2.20.0] - 2026-04-02

### Added
- **Theme system v3** — two-axis architecture: Style (Classic / Neo Brutal) × Palette (Default / Ocean / Rose / Forest / Midnight / Mono), each with full light + dark variants
- **Mono palette** — pure black/white/gray color scheme with no accent color
- **Neo Brutal style** — bold borders, hard shadows, uppercase buttons, snap hover effects across all components
- **Theme picker UI** — redesigned Settings appearance section with 2-col style grid + 3-col palette grid

### Changed
- **TodayFocus Notion-style cleanup** — removed category description subtitles, rows now show only title + type tag + urgency tag (minimal, text-first)
- **Store upgrade** — `useUIStore` now manages `themeId` + `styleId` with CSS variable injection via `applyFullTheme()`

---

## [2.19.1] - 2026-04-02

### Changed
- **Today Focus Notion-style redesign** — left accent bars, compact type/urgency badges, row-click navigation, dual-line text (standard category hint + dynamic context reason)
- **Removed focus checkboxes** — items link to real entities; completion tracking removed as redundant
- **Removed progress ring** — no longer needed without checkbox state
- **Receivables logic fix** — subscription auto-billing items with future dates no longer appear in system recommendations
- **Rewrote demo seed data** — comprehensive fictional examples covering all entity types, pipeline stages, and edge cases for first-time users

---

## [2.19.0] - 2026-04-02

### Added
- **Today Focus two-tier design** — split into "截止事项" (due/overdue items driven by real due dates) and "AI 推荐" (strategy-based revenue/delivery/system recommendations)
- **Entity linking** — focus items now link to their source: click a task → opens Work page task panel, click a lead → opens Leads page lead panel, click a memo → scrolls to and highlights the memo on the dashboard
- **Due/overdue enrichment** — tasks and memos with `due <= today` automatically surface in the top tier with urgency badges (red for overdue, amber for due today)
- **Navigate-to-entity event system** — WorkPage and LeadsBoard listen for `navigate-to-entity` CustomEvents to open entity panels from anywhere in the app
- **Memo highlight animation** — `highlight-pulse` CSS animation for scroll-to-memo navigation

---

## [2.18.1] - 2026-04-02

### Added
- **Memo scope toggle** — segmented control (工作/个人) in HomeMemoSection AI input and manual add form, allowing users to choose work or personal scope when creating memos from the dashboard

---

## [2.18.0] - 2026-04-02

### Changed
- **Notion-style design system** — migrated from warm cream palette to Notion's clean white/gray design language (#ffffff bg, #37352f text, rgba borders, flat shadows)
- **Page tabs & segment switcher** — replaced background-fill active state with underline indicator (border-bottom: 2px solid)
- **Button active state** — replaced scale(0.97) transform with opacity: 0.7 for flatter feel
- **Card radius** — reduced from 16px to 6px across all card variants
- **Modal/BottomSheet radius** — reduced from 20/28px to 12px
- **Progress bars** — slimmed from 6px to 4px height
- **Sidebar** — neutral gray background, active item uses bg-tertiary instead of accent tint
- **Section labels** — removed uppercase and letter-spacing for quieter hierarchy
- **Mobile nav** — removed glass/blur effect, solid opaque background with border
- **All stat card icons** — replaced accent-tinted circles with neutral gray backgrounds
- **All AI input bars** — removed yellow tint, Bot icons use text-quaternary

### Fixed
- **Kanban drag-and-drop** — cards couldn't be dragged between columns in Tasks and Leads; added `useDroppable` to column containers (SortableContext alone doesn't create droppable zones)
- **Login after logout** — user menu now shows "登录/注册" button when logged out instead of requiring navigation to Settings
- **Undefined CSS variable** — `--layer-nav` referenced but never defined; replaced with `--layer-header`

### Removed
- **Neo-brutalist theme** — deleted `neo-brutalist.css` (914 lines) and theme switcher; unified on single Notion-style design
- Unused imports: `useCallback` (App.tsx), `useEffect`/`useUIStore` (QuickCreateMenu.tsx), `TouchSensor` (KanbanBoard/LeadsBoard), `Circle`/`Pencil` (HomeMemoSection)
- Dead `handleDragOver` callback in KanbanBoard

## [2.17.1] - 2026-04-01

### Fixed
- **Neo-brutalist input focus border too thick** — replaced heavy black 2px border + 2px ring focus state with golden yellow (#f5c518) border + 1px ring; affects login page and all text inputs

## [2.17.0] - 2026-04-01

### Changed
- **Unified design language across both themes** — comprehensive audit ensuring every component follows its respective theme's design language consistently
- **Visual hierarchy overhaul** — Dashboard now has clear primary (KPIs) → secondary (Today's Focus) → tertiary (Growth System) content zones with section spacing
- **KPI typography system** — new `.kpi-value` / `.kpi-label` / `.kpi-sub` CSS classes with larger numbers (22→24px desktop), proper tracking, and neo-brutalist uppercase treatment
- **Sidebar floating layout** — increased margins (12px original, 8px neo-brutalist) for breathing room on all sides
- **Page tabs & segment switcher redesigned** — removed card-like active state (border+shadow) in original theme; both states now feel cohesive with subtle background indicator
- **Table styling via CSS** — client table headers, row borders, and hover states moved from inline styles to `.card table` CSS rules; works in both themes automatically
- **Badge variant system** — 6 semantic CSS classes (`badge-success`, `badge-warning`, `badge-danger`, `badge-accent`, `badge-blue`, `badge-orange`) replacing inline color-mix styles
- **Progress bar components** — new `.progress-track` / `.progress-fill` classes used in MonthlyGoal and BreakthroughSection; neo-brutalist adds 2px border
- **Protocol step states** — `.protocol-step`, `.protocol-done`, `.protocol-current` CSS classes replacing inline borderLeft/opacity
- **Icon circle components** — `.icon-circle-success` / `.icon-circle-danger` for transaction type indicators
- **Neo-brutalist theme polish** — KPI labels uppercase with letter-spacing, badge variants get border+shadow, tables get strong header separator with soft row dividers, sidebar gets floating margins

### Removed
- Inline `onMouseEnter`/`onMouseLeave` hover handlers on client table rows (CSS handles it)
- Inline `style={{ fontWeight }}` on table headers (CSS `.card table th` handles it)
- Inline badge color-mix styles across ClientList, TaskCard, TransactionList

## [2.16.0] - 2026-04-01

### Added
- **Switchable theme system** — new visual theme architecture via CSS custom properties + `data-theme` attribute, orthogonal to light/dark mode
- **Neo-Brutalist theme** — complete theme with zero border-radius, 2px hard borders, offset shadows, lime accent (#c8ff00), hot pink/cyan pops, mechanical animations, squared avatars, monospace section labels
- **Theme picker in Settings** — visual grid with live swatch previews showing bg/accent/border/radius/shadow per theme

### Fixed
- **Critical: sign-out data isolation** — sign-out now performs full 5-step cleanup: module caches → Supabase session → Zustand stores → offline queue + sql.js database → localStorage widget keys
- **Cross-user offline queue replay** — offline write queue is now cleared on sign-out, preventing User A's queued operations from replaying under User B's account
- **Cross-user local database leak** — sql.js in-memory database and IndexedDB persistence are now cleared on sign-out
- **Module-level cache race conditions** — `_cachedUserId` and `_cachedAuthed` are now explicitly reset before sign-out, eliminating timing windows where stale user IDs could route requests incorrectly
- **Avatar persisting across accounts** — all user-specific localStorage keys (countdowns, energy, focus-skipped) are now purged on sign-out; settings store fully reset (name, avatar, currency, timezone)

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
