# Changelog

All notable changes to Solo CEO are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [2.47.1] - 2026-04-18

Two high-severity data-correctness fixes — both silently corrupted real user data.

### Fixed
- **Fresh Supabase signups no longer get demo data baked into their cloud account.** `seedData()` in `src/db/seed.ts` previously ran whenever the local `leads` table was empty — which it always is for a new user. Because `pullCloudToLocal()` deliberately `continue`s on 0-row responses (to avoid a different class of sync glitch wiping real data), the Ming Design Studio demo rows that got seeded at startup then stuck permanently, and any edit the user made on top of them silently pushed the demo rows up to Supabase as if they were the user's work. New `hasPersistedSupabaseSession()` guard scans localStorage for `sb-<project-ref>-auth-token` / legacy `supabase.auth.token` keys and skips seeding entirely when a real session exists. Anonymous / "Skip login" users still get the full demo. Known limitation: an anonymous-user-who-then-signs-up still carries their existing local (demo) data into the authenticated session — resolving that requires a separate "upload local → cloud or wipe local" decision and is out of scope here.
- **Offline queue ID remapping is now partitioned by entity type.** The replay map was `Map<number, number>` keyed by bare local ID, but SQLite AUTOINCREMENT is per-table — `client(id=1)`, `project(id=1)`, and `task(id=1)` can all coexist in a fresh offline DB. When the queue replayed, each POST's mapping overwrote the previous under the same key, and later ops that referenced `client_id: 1` got remapped to whatever entity happened to be last in the replay order. Milestones, finance transactions, and subtasks created offline would silently attach to the wrong object once sync ran. Fix: `QueuedOp.localScope` records the table the `localId` belongs to (derived from the POST path at enqueue time via `pathToScope()`); the replay map is now `Map<"scope:localId", remoteId>`; `remapPath()` walks URL segments and resolves each numeric segment under its preceding non-numeric segment as scope; `remapBody()` uses a `fieldScope()` lookup that handles the polymorphic `source_id` field by inspecting `body.source`. Backward compat: queue entries without `localScope` (from pre-upgrade builds) skip downstream-reference remapping — safer than falling back to the old cross-table-collision behavior.

## [2.47.0] - 2026-04-18

Largest cleanup release since 2.40 — eleven focused commits, no user-facing visual changes, but several real and latent bugs (money precision, sync silent failures, UIStore missing state, AuthProvider stale closure, subscription timeline silent data loss) fixed along the way. Core tooling now enforces correctness instead of trusting convention: TypeScript `strict` is on, ESLint (flat config) wired into `npm run lint`, and the unit-test count grew from 52 → 99.

### Added
- **Hash-based routing.** Top-level tabs are URL-addressable (`#/home`, `#/finance`, …), shareable, bookmarkable, and the browser Back/Forward buttons navigate between tabs. Nested state (panel tabs, detail views) stays component-local for now, but the parser already tolerates `#/clients/42`-style trailing segments so a follow-up can deep-link without reworking the hook.
- **Currency setting now drives the whole UI.** `settings.currency` had been silently ignored — `$` was hard-coded in 25+ places even though the Settings screen offered CNY / EUR / GBP / etc. New `formatMoney()` / `getCurrencySymbol()` helpers in `src/lib/format.ts` are `Intl`-backed, fall back to a symbol table for unknown codes, and handle NaN / null / string / signed inputs defensively. Every money render path (Finance page, FinanceChart, TransactionList, ClientList, AIChatPanel) reads `currency` from the store live.
- **`useQuickCreateIntent(type, onTrigger)` hook.** Replaces the old `window.dispatchEvent(new CustomEvent('quick-create'))` + `setTimeout(100)` pattern that silently lost events when the target page's lazy chunk hadn't mounted. Pages just call the hook; the store's durable `pendingQuickCreate` slot delivers the intent atomically with the tab switch.
- **`useCloudSettingsSync(user, onStreakLoaded)` hook.** App.tsx had a 33-line `useEffect` that fetched `/api/settings` and reached into seven stores + two localStorage keys from the middle of layout code; now a named hook with four internal bucket functions (`hydrateProfileFields` / `hydratePreferences` / `hydrateTheme` / `hydrateWidgets`).

### Changed
- **TypeScript `strict` mode enabled.** `tsconfig.json` gets `"strict": true`; ~30 real type-safety issues surfaced and were fixed.
- **ESLint (flat config) wired into `npm run lint`.** `@eslint/js` + `typescript-eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks`. Lint currently green with warnings-only.
- **`src/app/App.tsx` shrinks from 969 → ~720 lines** after extracting `SidebarItem.tsx`, `MobileNavItem.tsx`, `SyncToast.tsx`, `tabs.tsx`, `useCloudSettingsSync.ts`, and `useHashRoute.ts`.
- **`src/db/api.ts` shrinks from 1927 → ~105 lines.** The `handleApiRequest` god function is now a dispatcher chain over 15 per-domain handler files (`leads`, `clients`, `milestones`, `tasks`, `plans`, `finance`, `content-drafts`, `today-focus`, `dashboard`, `weekly-report`, `agents`, `conversations`, `settings`, `server`) plus shared `schema.ts` + `seed.ts`. 24 new smoke tests cover the dispatcher wiring.
- **Vite `manualChunks` rewritten in function form.** `vendor-react` was generating an empty chunk (the object form collided with static entry imports), so React + react-dom ended up inlined into the main bundle. Main `index-*.js` drops ~73 KB gzipped, and a returning visitor with a cached `vendor-react` now skips ~60 KB on future releases.
- **PWA precache excludes SVG peeps.** `globPatterns` no longer includes `.svg`; illustrations move to runtime `CacheFirst`. Precache manifest: 4575 → 2484 KiB, entries 149 → 113.
- **CommandPalette lazy-loaded.** ⌘K keyboard handler moved up to `App.tsx` so the shortcut works before the palette chunk has loaded; palette mounts on `commandPaletteOpen`.
- **`useIsMobile` threshold aligned with Tailwind's `md:` (768 px).** Was 1024 (`lg:`), so viewports in the 768–1023 range rendered the desktop CSS layout while JS code branching on `useIsMobile` still believed it was on a phone. `MOBILE_BREAKPOINT` exported so future callers use the same constant. Implementation switched from resize + debounce to `matchMedia('change')`.
- **`quick-create` CustomEvent channel retired.** Seven emit sites (FAB on desktop + mobile, keyboard `N`, command palette) and four consume sites (Finance / Leads / Work / Client pages) all moved to the store. Intents are visible in devtools as normal store transitions, and misspelling a `QuickCreateType` is now a compile error.
- **`sync-status` CustomEvent channel retired.** sync-manager + offline-queue write directly into `useSettingsStore.setSyncStatus` / `setPendingOps`; App and SettingsPage drop their listeners and subscribe to the store. Queue warnings now surface as `sync-toast`s (previously dispatched with a shape nobody read).
- **AuthProvider session race hardened.** The 6-second `getSession()` timeout callback read `loading` from a stale closure (always `true` from the initial render), so a successful session refresh that landed close to the 6-second mark could still flip the user into offline mode. Replaced with a local `resolved` flag. Signing out now also clears `solo_agents_seeded` / `solo_agents_seeded:*` localStorage markers.
- **sync-manager error surface.** A Supabase fetch error used to be swallowed identically to an empty result (`if (error || !rows) continue`) — sync quietly stopped for that table with no UI hint. Errors now log via `console.warn`, aggregate into a single toast per cycle, and the top-level `catch` logs via `console.error` + warns the user instead of eating the exception.
- **offline-queue batch loop.** The step size was computed from `ordered[i]?.method`, so if an entry became `undefined` mid-replay (concurrent `removeOp`) the index could stall → infinite loop. Rewritten as an explicit `while` with a guaranteed positive step.
- **Shared modules extracted to eliminate drift:**
  - `src/lib/types/finance.ts` — `FinanceTransaction` was declared three times with inconsistent `client_id` nullability; rows passed between modules silently lost the `null` case.
  - `src/lib/types/client.ts` — same for `ClientItem`.
  - `src/lib/subscription-timeline.ts` — sanitises the JSON column (malformed data previously triggered a silent soft-delete of every subscription ledger row on next sync); applied on both offline and online write paths.
  - `src/lib/finance-report.ts` — HTML monthly-report template was duplicated in `db/handlers/finance.ts` and `db/supabase-api.ts`; CSS tweaks only have to be done once now.
  - `src/lib/ai-client.ts :: parseMemo()` — HomeMemoSection previously hand-wrote a per-provider `fetch` for each of OpenAI / Claude / Gemini / Ollama and hard-coded `gpt-4o-mini` (drifted from `MODEL_IDS.openai = gpt-4.1-mini`); now a one-liner that picks up the canonical model.
- **`TX_STATUS` constant** in `src/lib/tax.ts` replaces six hot sites that hard-coded the three canonical transaction status strings. One full-width vs half-width bracket typo would have silently broken a status filter.
- **`db/api.ts :: exportAllData`** reuses `PROFILE_SYNC_KEYS` from `useSettingsStore` instead of maintaining its own `FIELD_MAP` (which had already drifted and silently dropped `personalPreferences`).

### Fixed
- **Money precision.** All twelve money / rate columns across seven tables (`clients.mrr` / `project_fee` / `tax_rate`, `plans.price`, `finance_transactions.amount` / `tax_rate` / `tax_amount`, `payment_milestones.amount` / `percentage`, `client_projects.project_fee` / `tax_rate`, `client_subscription_ledger.amount`) converted from `DOUBLE PRECISION` (IEEE-754 float) to `NUMERIC(14, 2)` or `NUMERIC(7, 4)` (exact decimal). Floating-point drift on accumulating sums was a real "off by one cent" bug factory. Migration `012_money_columns_to_numeric.sql`. Pre- and post-migration `SUM()`s match exactly across all eight money columns — no value lost.
- **`today-focus` handler accepted arbitrary unbounded `type` values on `PUT`.** A non-string / object / huge-string `type` would land in the column as-is. Both `POST` and `PUT` now route `type` / `title` / `note` through `str()` with length caps matching other handlers.
- **`subscription_timeline` wasn't JSON-validated on write.** Any non-array or malformed JSON silently fell through the reader's `[]` fallback and the ledger sync would soft-delete every existing subscription ledger row — a scary "my invoices disappeared" silent data loss. Sanitised via `sanitizeSubscriptionTimeline()` on both offline and online write paths.
- **`solo_agents_seeded` localStorage marker** was global, not user-scoped — a second user signing in on the same device inherited the first user's "already seeded" flag and never got default agents. Key now carries `${user?.id || 'offline'}` suffix; signing out clears all matching entries.
- **`UIState.pendingQuickCreate` and its two action members** were declared on the interface but never implemented. Strict mode caught it.
- **`LeadsBoard` unsafe `as unknown as Record<string, Lead[]>` casts** removed; `LeadKanbanProps.leads` narrowed to `Record<ColId, Lead[]>`.
- **AIChatPanel `streamOneAgentRef`** no longer uses `useRef<Fn>(null!)` (which lied to TypeScript about nullability); now `useRef<Fn | null>(null)` with a guard at the single call site.
- **Recharts tooltip `Formatter` signature** updated for Recharts v3 (was typed against the v2 shape, producing a strict-mode error).
- **Widget store `migrate` signature** updated to match Zustand persist's `persistedState: unknown` contract.

### Removed
- **`src/features/home/widgets/types.ts`** — dead file. `WidgetDef` was declared there with `icon: string` + `size` fields that nothing imported; the live definition in `WidgetRegistry.tsx` uses `icon: React.ReactNode` and no size.

### Database
- Migration `012_money_columns_to_numeric.sql` — applied to production 2026-04-18.

## [2.46.0] - 2026-04-15

### Added
- **Cursor-driven spotlight + edge ring now covers Finance, Settings, and the user-menu button.** The pointer-aware glow introduced in 2.45.0 on Home/Work/Clients surfaces now extends to:
  - Finance page — the Cash Flow Trend chart and Recent Transactions list (both income and expense tabs).
  - Every Settings module — Profile, Account, Security, Plan, Appearance, AI, and Custom Agents cards.
  - Sidebar user-menu button (operator avatar / 李明) — uses the smaller `.nav-glow` variant sized for ~36px controls so the ring/spotlight fits the button instead of the card defaults.
- **`useUIStore.pendingQuickCreate` — durable quick-create intent (store plumbing, no UI surface yet).** New typed state + `setPendingQuickCreate` / `clearPendingQuickCreate` actions, each pending intent carries a monotonic token so consumers re-fire on the same type in succession. Designed to replace the fire-and-forget `quick-create` CustomEvent that dropped events when the target page was still lazy-loading. Wiring the FAB / command palette / `N` shortcut through this API will land in a follow-up.

### Changed
- **Figma style renamed to "Google+Figma" in the style picker.** i18n key unchanged (`settings.style.figma`); just the display string now reflects the hybrid influence.
- **Figma style — black interactive chrome swapped for signature Figma blue** (`#0c8ce9` light / `#56b0f0` dark). Accent color, focus outline, input focus border, and active tab background all move to blue. The card/background neutrals remain pure white/black; only interactive accents change.
- **Style picker previews now render each style's own signature color**, not the currently-applied theme's accent. Previously the picker's internal preview bars/chips used live `var(--color-accent)`, so selecting any theme made all five preview cards re-colorize to that theme — defeating the point (users couldn't see at a glance that Neo Brutal is pink, Cal is black, Carbon is IBM blue, etc.). New static `accent` field on `StylePreview` holds each style's light-mode brand hex (Classic `#f5c518`, Neo Brutal `#e84393`, Cal `#292929`, Google+Figma `#0c8ce9`, Carbon `#0f62fe`). Bottom-chip accent opacity bumped from `0.12` → `0.35` so lighter accents read clearly on the card background. Outer selected-card ring still uses `var(--color-accent)` — that's intentional, since it indicates the applied state.
- **Afternoon home-page peep swapped to `growth`.** Previously a `growth` peep (cross-legged, reading) sat at the bottom of the expanded sidebar and `looking-ahead` played the afternoon slot on the HomePage greeting card. The sidebar illustration is gone, and `growth` now plays the afternoon slot — one peep, surfaced where it belongs.

### Fixed
- **QuickCreateMenu — menu no longer closes before `onClick` fires.** The outside-click dismiss was racing the menu item click, so some quick-create taps (New Task / New Client / New Lead / New Expense from the FAB) silently did nothing. Delay order now keeps the click through to the handler.
- **Offline↔online schema parity.** sql.js offline mirror was missing `clients.created_at` / `clients.updated_at` and `leads.updated_at` columns that exist on the Supabase side; added with defaults + backfill on DB open so sync comparisons line up. Demo seed also gains an AI draft on the proposal-stage lead so empty-state doesn't greet fresh-install users who open the proposal panel.
- **Demo seed — coverage gaps closed.** Linked tasks/finance/milestones to real clients, added content drafts and focus events, added a paused client / HST tax case / broader expense mix so the offline demo is no longer a toy dataset.

## [2.45.0] - 2026-04-15

### Added
- **Pointer-driven spotlight + animated edge ring.** New `src/lib/mouse-effects.ts` runs a single rAF-throttled `pointermove` listener and writes `--mx` / `--my` CSS custom properties (as percentages) on the element under the cursor, for anything matching `.card-interactive, .card-glow, .stat-card, .widget-card, .nav-glow, .sidebar-glass, .ai-chat-panel`. CSS does all the rendering via `::before` (radial-gradient tint) and `::after` (`mask-composite: exclude` 1px border ring), so the main thread stays idle — JS only sets two CSS vars. Guards: `(prefers-reduced-motion: reduce)` and `(hover: hover)`. Applied to sidebar, AI chat panel, home KPI + widget cards, work Kanban cards, leads board cards, and clients list rows.
- **Confetti celebrations.** New `src/lib/celebrate.ts` (wraps `canvas-confetti`, dynamic-imported so it stays out of the main bundle). Fires on sales wins, milestone completions, and streak achievements. Respects `prefers-reduced-motion`.
- **Animated tab pill.** New `src/components/ui/TabPill.tsx` — shared-layout Motion pill for `.page-tabs` segmented controls (Work: work/personal, Finance: income/expense, Home: Dashboard/Widgets).

## [2.44.2] - 2026-04-15

### Fixed
- **iOS Safari — AI chat input no longer zooms the page when tapped.** Both the main chat textarea and the inline edit-message textarea used `text-[14px]` without the `.input-base` class, so the global mobile anti-zoom rule (`font-size: max(16px, 1em)`) didn't apply. On iPhone Safari, tapping into the chat input would zoom the page in and leave it stuck at the zoomed level. Fixed by bumping to `text-[16px] lg:text-[14px]` — mobile gets 16px (zoom-safe), desktop keeps 14px.
- **Pre-mount fallback screens — switched to dynamic viewport height.** `ErrorBoundary` and the bootstrap fatal-error fallback now use `height: 100dvh` instead of `100vh`, so the fallback UI sits correctly within the visible area on iOS Safari (which excludes the URL bar from `dvh` but includes it in `vh`).

## [2.44.1] - 2026-04-14

### Fixed
- **Sync reliability — closed several silent data-loss paths.** Data layer audit tightened the offline↔online sync seam: offline queue now remaps server IDs back onto pending operations after replay (prevents stale local IDs lingering); settings cache invalidation fires on every write path (stale cache after profile edits fixed); silent `catch {}` blocks across the data layer replaced with scoped `console.warn('[module] action', e)` so failures are visible instead of swallowed.
- **Settings profile save — toast now reflects the actual API result.** Previously the "Saved" toast fired the instant you clicked save, regardless of whether the network request succeeded. Now the success toast waits for the POST to resolve, and a `common.saveFailed` toast fires if it rejects. Same pattern applied to avatar upload/remove.
- **Form accessibility — screen readers now announce input errors.** `Input`, `TextArea`, and `Select` components now link their error span to the control via `aria-invalid` + `aria-describedby`. Previously the red error text rendered visually but was disconnected from the field for assistive tech.
- **Dynamic imports — failed chunk loads no longer surface as unhandled promise rejections.** `PeepIllustration` (lazy SVG) and `i18n/context` (lazy EN bundle) both add `.catch()` branches. Offline first-visit users switching language, or CDN flakes while loading an illustration, now log a tidy `console.warn` instead of a red unhandled rejection.
- **Work page — stale AI model IDs + double-diff on task edit.** Removed hardcoded model IDs that drifted from the central registry; fixed a double-diff computation that sent redundant fields on task update.

### Changed
- **Error-logging convention unified across the codebase.** All `catch {}` / `catch (e) {}` blocks in feature modules (home, work, clients, finance, settings, UI components) converted to `console.warn('[Component] action', e)` with enough context to locate the source without opening a debugger.
- **AI model IDs centralized.** `src/lib/ai-client.ts` is now the single source of truth for all model ID strings; individual features (work breakdown, lead scoring, content generation) no longer hold their own copies. Updating a model ID in one place updates everywhere.
- **i18n — two misplaced keys moved to the correct file.** `settings.knowledgeLibrary` and `settings.knowledge.progress` now live in `en/settings.ts` (matching the zh side); previously they sat in `en/clients.ts` — no runtime impact (all shards merge into a flat dict) but `grep` now finds them where you'd expect.

## [2.44.0] - 2026-04-14

### Changed
- **AI Chat panel — smoothed all motion.** Seven animation fixes so the panel feels like one surface with the content layout:
  - Panel slide-in/slide-out now uses the same tween (`0.3s cubic-bezier(0.4, 0, 0.2, 1)`) as the content-panel CSS push, so the chat and the content it displaces move as one instead of racing each other.
  - Desktop conversation sidebar animates its width (0 → 180px) and opacity together on toggle, replacing the abrupt show/hide.
  - Agent picker, more-menu (⋯), and @-mention dropdowns all animate in with matched `opacity + scale(0.96 → 1)` and correct transform-origins (top-left / top-right / bottom-left respectively) — no more popping.
  - Scroll-to-bottom button fades + translates with `whileHover: 1.05 / whileTap: 0.92` press feedback.
  - Typing indicator cross-fades smoothly with the first streaming token instead of flashing in then being replaced.

- **Chat-open compression now applies across the whole app, not just Home.** When the AI chat opens on desktop, the content panel compresses to ~half width. Previously only Home adjusted its grids; Clients and Finance kept showing squished desktop tables. Now:
  - `.content-panel.chat-open` overrides `md:grid-cols-*` / `lg:grid-cols-*` to `1fr`, `md:col-span-*` / `lg:col-span-*` to `span 1`, and `md:flex-row` / `lg:flex-row` to `column` — HomePage KPI grid and all other multi-column layouts collapse cleanly.
  - `md:hidden` / `lg:hidden` elements inside the panel are revealed, and `hidden md:block/grid/flex` / `hidden lg:block/grid/flex` elements are hidden, so ClientList swaps its desktop table for mobile cards and TransactionList does the same swap when rendered in-flow.
  - Rule excludes `[class~="fixed"]` so mobile chrome (`mobile-top-bar`, `mobile-bottom-bar`, mobile FAB) keeps honoring the viewport — opening chat on desktop no longer leaks the mobile top bar / bottom nav / FAB into the desktop view.

- **Personal Preferences editor — refined UX.** Added placeholder guidance, a "Clear" button with confirmation, an overwrite-confirm on import (so accidentally dropping in a file can't silently wipe existing content), and tightened the file-size limit from 50KB → 10KB. New i18n keys: `settings.preferences.placeholder / .clear / .saved / .overwriteConfirm / .clearConfirm`.

## [2.43.0] - 2026-04-14

### Changed
- **Design system overhaul — unified spacing, colors, radii, shadows.** All surface-level visuals adjusted for consistency across the app:
  - **Layout symmetry** — sidebar top edge now aligns with the first content card (both at 12px); main content wrapper uses `md:my-3 md:mx-3` so left-to-sidebar gap equals right-to-viewport gap. Page-level top padding removed on desktop (`md:pt-0 lg:pt-0`) across all 7 pages (Home, Work, Leads, Clients, Finance, Settings) so the first card sits flush with the sidebar top.
  - **Background color** — `--color-bg-primary` and `--color-bg-panel` changed from `#ffffff` to `#fdfdfc` (warm off-white). Applies to app shell, all `.card`/`.card-elevated`/`.card-interactive` backgrounds, and panel surfaces.
  - **Hover / Select gray unified** — `--color-bg-tertiary` (hover) and `--color-bg-quaternary` (select/active) both set to `#e5e5e4`. Replaces the fragmented `#f1f0ed` / `#e9e8e4` pair used across 59 `hover:bg-[var(--color-bg-tertiary)]` sites in 26 files.
  - **Corner radius** — `--radius-base` changed from `6px` to `10px` (new `--radius-10` token added). Applies to all cards, the sidebar frame, buttons, badges, and tab pills.
  - **Card + sidebar shadows** — `--card-shadow` is now `var(--shadow-medium)` (was `none`); `--sidebar-panel-shadow` is now `var(--shadow-medium)` (was `none`). Shadow tokens themselves re-tuned with larger spread: `--shadow-low` `0 2px 6px / 5%`, `--shadow-medium` `0 4px 14px / 7%`, `--shadow-high` `0 8px 24px / 10%` in light; proportionally stronger in dark.
  - **HomePage spacing consolidated to a 4-tier scale (4 / 8 / 16 / 24 px)** — all card padding is `p-4` (was a mix of `p-3`/`p-5`/`px-5 py-4`); all inter-card gaps are `gap-4` (was `gap-5`/`gap: 12`); `.page-stack` between-section gap is `24px` (was `20px` mobile / `24px` desktop); list row heights are `py-3` (was `py-2.5`/`py-3.5`). Affects KPIGrid, HomePage greeting card, TodayFocus/BreakthroughSection/ActivityTimeline/ProtocolSection rows, KnowledgeBaseSection inner panels, ProfileSection form card, ClientList main row.
  - **Accent-tint overlays removed** — HomePage greeting card no longer has the yellow accent-tint wash; LoginPage left illustration panel no longer has the yellow tint either. Both surfaces now use the same `--color-bg-primary` as every other card.

## [2.42.2] - 2026-04-14

### Changed
- **App icon** — replaced the yellow "S" favicon/PWA icons with the Open Doodles `astro` character (small astronaut with helmet). Updates `public/favicon.svg`, `public/icon-192.png`, `public/icon-512.png` (also used as maskable).

### Fixed
- **LM Studio streamChat missing `max_tokens`** — responses could be truncated at model-specific defaults. Now explicit `max_tokens: 16384` matching OpenAI/Claude.
- **AI JSON / text temperature drift across providers** — `callJSON` now pins `temperature: 0` on Gemini/Claude/OpenAI (was inheriting 1.0 defaults). `callText` pins `temperature: 0.2` on all five providers (Ollama/LM Studio already had 0.2). Structured output is deterministic; free-form text has the same mild randomness everywhere.
- **Offline `/api/clients` GET used `SELECT *`** — swapped to the same explicit 27-column list as `supabase-api.ts` so a new column can't silently appear in one handler but not the other.

### Changed
- **i18n: `settings.ai.ollama*` → `settings.ai.local*`** — the URL / Model / Refresh / Connected strings were already generic and shared between the Ollama and LM Studio sections. Renamed the keys (zh + en + AISection.tsx) so semantics match usage.

## [2.42.1] - 2026-04-14

### Fixed
- **LM Studio cannot call tools** — `streamChat` LM Studio branch was ignoring the `nativeTools` parameter; now passes `tools` + `tool_choice: "auto"` in OpenAI-compatible format so LM Studio models can create tasks, update clients, etc.
- **Local models without native tool support** — local-model system prompt now includes both the native tool API hint AND text-based tool definitions as fallback. Models that support native function calling use the API path; models that don't output JSON in text which `parseToolCall()` handles. Covers the full range from qwen/llama3.1 (native) down to smaller models that only do text JSON.

## [2.42.0] - 2026-04-14

### Added
- **IBM Carbon theme** — new palette and style selectable in Settings → Appearance. Palette uses Gray 10–100 neutrals + Blue 60 accent in light, Blue 40 in dark; style enforces 0px radius everywhere (buttons, cards, inputs, badges, tabs), IBM Plex Sans/Mono loaded from Google Fonts with display headings at weight 300, micro-tracking (0.16px body / 0.32px label), Gray 10 inputs with the signature bottom-border + 2px inset blue focus ring, Blue 60 ghost button text, Carbon productive-motion duration scale (70/110/240/400 ms), flat surfaces with shadows reserved for floating elements, tab underline indicator, and custom 8px scrollbars. The two layers are independent — mix either with an existing palette/style for partial fidelity.

### Fixed
- **AI chat — LaTeX math leaks** — models frequently wrap trend arrows and operators in LaTeX even when no math renderer is available (e.g. `$\rightarrow$`, `\(\approx\)`). Added a preprocessor that maps ~40 common LaTeX commands (arrows, relations, Greek letters, operators) to their Unicode equivalents, covering all four delimiter variants `$...$`, `$$...$$`, `\(...\)`, `\[...\]`. Only transforms a delimiter pair when every token inside is a known command — `$50`, `$5.00`, `$var$`, and mixed content like `$\rightarrow 10%$` are all left untouched to avoid deleting user content.
- **AI chat — malformed headings** — `#Title` without a space now gets normalized to `# Title` before ReactMarkdown, fixing a common small-model formatting slip that silently failed to render as a heading in GFM. Regex leaves `###` separator rows and properly-spaced headings alone.

## [2.41.0] - 2026-04-14

### Changed
- **AI agent tools — single source of truth** — all 15 tools (schema, safety tier, bilingual labels/prompts, executor, confirm card) now live in one central registry at `src/app/tools/registry.ts`. `ai-tools.ts` and `agent-types.ts` derive `AGENT_TOOLS`, `TOOL_SAFETY`, `TOOL_LABELS`, `ALL_TOOL_NAMES` from the registry instead of maintaining parallel lists. Adding a tool is now a one-file change.
- **Per-turn tool cache** — multi-step agent turns share a `ToolContext` with a request-scoped cache, so consecutive tool calls that hit the same endpoint (e.g. `findByTitle` after `search_data`) reuse the first response. Writes invalidate the relevant endpoints automatically.
- **`search_data` pagination** — accepts an optional `limit` (1–50, clamped server-side, default 10) and returns `{ total, items }` instead of a bare array. The truncation-aware message ("Found 23 items (showing first 10)") lets the model realize when it needs to raise `limit` — previously it silently only saw the first 10.

### Added
- **`delete_lead` + `delete_client`** — close the CRUD asymmetry with `delete_task`. Both are `safety: "destructive"` so they always require user confirmation. `delete_client` warns in its prompt hint and confirm card about the soft-delete cascade (unlinks tasks by `client_id`, nulls `finance_transactions.client_id`, soft-deletes milestone-linked finance rows) and steers the model toward `update_client status=Cancelled` for churn.
- **`record_transaction` category guard** — validates `category` against the scope enum (business: 收入/软件支出/外包支出/其他支出, personal: 餐饮/交通/房租/娱乐/个人其他) before POSTing. Invalid categories short-circuit with the allowed list in the error message so the model can self-correct without a DB round-trip — no more stray "餐饮" entries on business scope.
- **Default agent templates updated** — Chief of Staff (`general`) now uses `[...ALL_TOOL_NAMES]` so future tools auto-flow in (the literal list had already drifted and was missing the two new deletes). Sales & Client Manager (`sales`) gains `delete_lead` + `delete_client` for cleaning up duplicates and test entries. Existing agent records don't auto-upgrade — users can "sync from template" to pick up the new tools.

## [2.40.0] - 2026-04-14

### Fixed
- **Drag-and-drop cursor offset** — Kanban/Leads cards no longer jump to the right of the cursor while dragging. Root cause: `.page-enter`'s animation kept a `transform: matrix(1,0,0,1,0,0)` on the wrapper (via `animation-fill-mode: both`), which per CSS spec creates a containing block for `position: fixed` descendants — so `<DragOverlay>` anchored to the page wrapper (offset by the sidebar width) instead of the viewport. `page-enter` now animates opacity only.
- **DnD sensor gating** — drag was disabled on desktop when the window was narrower than the `lg` breakpoint. New `useIsTouchPointer` hook (`matchMedia('(pointer: coarse)')`) replaces viewport-width detection for sensor activation.
- **Lead swimlane hooks violation** — extracted `SortableLeadSwimlaneCard` so `useSortable` is no longer called inside `.map()`.

### Changed
- **Leads card mount animation** — now matches the Tasks page (opacity + scale spring via framer-motion `AnimatePresence`).
- **Sortable card architecture** — outer `<div>` owns the dnd-kit transform; inner `motion.div` owns intro/exit. Transform/transition suppressed while `isDragging` so `DragOverlay` alone represents the floating card.

### Added
- **AI chat markdown tables** — styled table rendering that matches design tokens, plus `normalizeTabTables()` upstream of the renderer to convert Gemini's tab-separated tables into GFM pipe tables.

### Database
- **Idempotent base schema** — `000_full_schema.sql` drops the destructive `DROP … CASCADE` prologue and switches all DDL to `CREATE … IF NOT EXISTS`, so running it on an initialized project is a no-op.
- **RLS / perf / realtime migrations** — supersedes `001_split_rls_policies` and `002_soft_delete_rls_guard` with `001_optimize_rls_policies` and `002_fix_function_search_path`; adds `007_drop_unused_indexes`, `008_tasks_add_scope_parent_client`, `009_clients_subscription_timeline`, `010_optimize_rls_ai_and_projects`, `011_fk_index_realtime_and_cleanup`. `ai_agents` gains a partial unique index `(user_id, template_id) WHERE NOT soft_deleted` so each user has at most one active agent per template.

### Chore
- **Claude model id** — `ai-client.ts` switches from dated `claude-sonnet-4-6-20250514` snapshot to the `claude-sonnet-4-6` alias at all four call sites (JSON / text / stream / key test).
- **`.env.example`** — dropped stale `GEMINI_API_KEY` stub; all AI keys are now entered in-app (Settings → AI) and stored per-user in `app_settings`.
- **`.claude/launch.json`** — Vite runtime path updated to `/opt/homebrew/bin/node` (Apple Silicon Homebrew).

## [2.39.0] - 2026-04-13

### Added
- **LM Studio support** — connect local LLMs via OpenAI-compatible API (model discovery, test, stream chat)
- **DESIGN.md** — comprehensive design system doc (colors, typography, components, motion, agent prompt guide)
- **AI chat max output tokens** — all cloud models now use maximum output limits (OpenAI/Claude 16K, Gemini 65K)

### Fixed
- **AI chat client data** — expanded client context in system prompt (subscription_timeline, payment_method, tax, dates) so AI can answer renewal/billing questions
- **Tool format garbage** — added `cleanToolGarbage()` to strip `<tool_code>`, Python syntax, and XML tags from AI responses; added anti-hallucination prompt instructions
- **GET field parity audit** — 13 missing fields across 4 endpoints:
  - `/api/clients`: `drive_folder_url`, `project_end_date`, `contact_name/email/phone`
  - `/api/clients/{id}/projects`: `project_start_date`, `project_end_date`, `tax_mode`, `tax_rate`
  - `/api/clients/{id}/milestones`: `invoice_number`, `note`, `project_id`
  - `/api/finance`: `project_id`

### Changed
- **Homepage redesign** — merged daily briefing, full month calendar, 2-column grid layout
- **Homepage density** — collapsible focus list, compact greeting, smart calendar rows

## [2.32.0] - 2026-04-10

### Security
- **XSS in finance report** — added `esc()` HTML escaping for all user-interpolated data in supabase-api.ts finance report template (online handler)
- **Avatar URL validation** — AIChatPanel tightened `data:` prefix check to `data:image/` to prevent non-image data URIs

### Fixed
- **Online/offline data parity** — 5 dashboard discrepancies resolved:
  - MRR calculation: online handler now uses ledger-first approach matching offline
  - workTasks: removed extra priority filter that excluded Low-priority tasks online
  - personalTasks: added `parent_id IS NULL` filter to match offline
  - client_projects GET: fixed wrong column names (`total_fee`→`project_fee`, `description`→`note`)
  - content_drafts: added to realtime subscription table list
- **Duplicate finance transactions** — offline mark-paid now checks `finance_tx_id` before INSERT, updates existing TX if already linked (matching online behavior)
- **Subscription ledger infinite loop** — added `isNaN` guard + 240-iteration max on date-advancing while loop in supabase-api.ts
- **Stale closure in AuthProvider** — `handleOffline` now reads `userRef.current` instead of captured stale `user` value
- **CommandPalette fetch storm** — restructured from 4 API calls per keystroke to fetch-once-on-open + client-side filtering
- **Invalid date crash** — ActivityTimeline `timeAgo()` now guards against `NaN` from invalid date strings
- **Avatar compression error** — SettingsPage added `img.onerror` handler for failed avatar image loads
- **UpdateButton timer leak** — interval managed via `timerRef` + useEffect cleanup
- **Hardcoded hex colors** — AIChatPanel agent colors changed from hex values to CSS custom properties
- **Plan price currency** — PlanSection now displays user's configured currency instead of hardcoded "$"
- **i18n hardcoded string** — AgentSection "Loading..." replaced with `t("common.loading")`

### Improved
- **Focus management** — Modal restores focus to trigger element on close via `prevFocusRef`; InlinePopover restores focus on Escape
- **Keyboard accessibility** — added `onKeyDown` (Enter/Space) handlers to clickable non-button elements in ClientList (project rows, milestone rows), TransactionList (mobile rows), and MiniCalendarWidget ("Today" button)
- **Skip-to-content link** — App.tsx now includes accessible skip-to-main-content `<a>` link
- **ARIA tab panels** — FinancePage tab buttons have `id` attributes; tab panels have `role="tabpanel"` + `aria-labelledby`
- **Immutable state updates** — WorkPage `handlePriorityChange` and `handleDueChange` create new objects instead of mutating in place
- **useMemo optimizations** — derived values memoized in ClientList (`uniquePlanTiers`, `activeN`, `pausedN`, `contractTotal`, `filteredIds`) and WorkPage (`totalTasks`, `counts`)
- **React.memo** — SortableLeadCard wrapped to prevent re-renders during drag
- **AbortController + timeout** — WorkMemoList AI fetch calls now have 30s timeout with proper cleanup
- **useLeadAI unmount safety** — added `mountedRef` guard to prevent state updates after unmount
- **IDB connection caching** — db/index.ts reuses IndexedDB connection instead of opening new ones per operation
- **LRU cache eviction** — data-cache.ts limits to 100 entries with oldest-entry eviction; dashboard cache explicitly invalidated
- **Realtime refresh stability** — useRealtimeRefresh uses `tables.join(',')` as stable dependency key instead of array reference
- **KnowledgeBaseSection lazy load** — moved dynamic import from module scope into useEffect for true lazy loading
- **Sync-manager concurrency lock** — Promise-based lock prevents overlapping sync/replay operations

## [2.31.0] - 2026-04-09

### Security
- **Gemini API key exposure** — moved from URL query string to `x-goog-api-key` header in 3 locations (ai-client.ts streaming, HomeMemoSection, WorkMemoList)
- **SQL injection risk** — deleted unused `importAllData` function that interpolated user-supplied column names into SQL
- **URL validation** — `window.open` for drive folder URL now validates `https?://` protocol before opening
- **Supabase null guard** — 16 `data!.id` non-null assertions replaced with proper `if (e || !data)` checks

### Fixed
- **18 TypeScript errors → 0** — fixed all pre-existing type errors across 7 files (CommandPalette, supabase-api, ClientList, LeadsBoard, ai-client, HomeMemoSection, WorkMemoList)
- **localStorage crash prevention** — 11 `localStorage.setItem` calls wrapped in try/catch to prevent QuotaExceededError crash
- **Timezone crash** — `dateToKey()` now catches invalid timezone RangeError with local-date fallback instead of crashing the entire app
- **CountdownWidget NaN** — `calcProgress` now guards against NaN from invalid date strings
- **PlanSection JSON.parse** — `features` field parse wrapped in try/catch
- **Business Rule #3** — `today_focus_manual` PUT handler changed to partial update in both supabase-api.ts and api.ts
- **Business Rule #13** — `useMilestones` and `useClientProjects` now diff against original data before PUT
- **Business Rule #15** — `env(safe-area-inset-*)` in main.tsx now includes `0px` fallback values
- **Business Rule #16** — replaced z-index magic numbers with CSS variables in App.tsx, MiniCalendarWidget, AgentModal
- **UTC date bug** — WorkMemoList and AIChatPanel now use timezone-aware `todayDateKey()` instead of UTC `toISOString().slice(0,10)`
- **DeepSeek removal** — removed unused deepseek code paths from HomeMemoSection and WorkMemoList

### Changed
- **KanbanColumn React.memo** — wrapped with `React.memo` to prevent unnecessary re-renders of 4 kanban columns
- **IndexedDB connection pooling** — offline-queue now caches the IDBDatabase connection instead of opening new ones on every operation

### Removed
- Dead code files: `MonthlyGoal.tsx`, `BottomSheet.tsx` (never imported)
- Unused exports: `fmtDueDate`, `fmtDateFull`, `syncPrefs`, `loadCloudPrefs`, `api.patch`
- Unused CSS classes: `.badge-purple`, `.header-glass`, `.section-gap`, `.segment-switcher`
- Unused `showToast` prop from SecuritySection

## [2.30.2] - 2026-04-08

### Fixed
- **Offline data loss** — cloud data now syncs to local sql.js on every sync cycle (login, reconnect, tab focus); previously local DB only had seed data, causing personal data to vanish when offline
- **Frontend partial updates (Rule #13)** — 5 forms now send only changed fields instead of full objects: ClientList, WorkPage task edit, PlanSection, FinancePage, useClientTransactions
- **Touch targets** — HomeMemoSection AI send button enlarged from 28×28 to 44×44px; `.btn-icon-sm` mobile size 32→40px
- **Offline queue docs** — removed false "exponential backoff" claim from comment (retries happen on next reconnect)

## [2.30.1] - 2026-04-06

### Fixed
- **AI Chat scope selector** — task/memo creation now shows business/personal toggle (was only on transactions)
- **Greeting card theme styles** — use `.card` class so it inherits neo-brutalism shadows, glassmorphism blur, HUD scanlines, material elevation; accent tint via overlay layer

## [2.30.0] - 2026-04-06

### Added
- **PeepIllustration component** — dynamic SVG import system with URL caching, dark mode filter, and lazy loading
- **38 Open Peeps SVG illustrations** — hand-drawn illustration library for empty states, greetings, and brand personality

### Changed
- **SVG optimization** — all 38 SVG files compressed with SVGO p2 multipass (2.6MB → 2.0MB, -23%)
- **Login page redesign** — asymmetric 45/55 hero+form layout with responsive illustration (160px mobile / 280px desktop)
- **Illustration audit** — semantic matching across all pages: greeting card (5 time-based peeps), sidebar (`growth` 130px), empty states per context
- **Removed 8 decorative fillers** — Protocol, KnowledgeBase, Breakthrough sections and 5 Settings bottom-of-form illustrations that failed purpose test
- **Zero duplicate illustrations** — every page uses unique peep selections matched to context
- **Finance empty states** — differentiated 3 contexts: business (`pacheco`), personal (`groceries`), desktop (`cube-leg`)
- **AI Chat illustrations** — sidebar empty (`chillin`), no-provider (`roboto`), multi-agent welcome (`experiments`), single agent (`pondering`)
- **KnowledgeBase card** — removed leftover `maxWidth: 85%` constraint after illustration removal, fixing chevron arrow position

### Removed
- Decorative-only illustrations from ProfileSection, AppearanceSection, AccountSection, SecuritySection, AISection

## [2.29.7] - 2026-04-06

### Changed
- **AI Chat i18n** — replaced 20+ hardcoded `lang === 'zh' ? ... : ...` ternaries in AIChatPanel with proper `t()` calls
- **Agent section i18n** — replaced hardcoded confirm/cancel/delete strings in AgentSection, AgentTestPanel, AppearanceSection with `t()` calls
- **AgentModal UX** — save button now disabled when name is empty; cancel button uses `t('common.cancel')`
- **Accessibility** — added `aria-label` to icon-only buttons in AgentSection, WorkMemoList, HomeMemoSection
- **Flex truncation** — added `min-w-0` to 3 flex+truncate elements (AIChatPanel, App sidebar, EnergyBatteryWidget)

## [2.29.5] - 2026-04-06

### Added
- **Mobile frosted edge fade** — top and bottom navigation areas now have gradient + light blur (`blur(4px)`) overlay, content fades smoothly into nav zones instead of hard cutoff

### Fixed
- **Cross-tab store crash** — cross-tab localStorage sync no longer overwrites Zustand action functions with `undefined`
- **IndexedDB save corruption** — `saveDb` now stores `new Uint8Array(data)` instead of `data.buffer` to prevent oversized ArrayBuffer corruption
- **Cross-user settings leak** — `invalidateSettingsCache` now clears in-flight promise to prevent stale data after sign-out
- **Language not reset on sign-out** — `resetForSignOut` now resets `language` to default
- **Cmd+K stale closure** — command palette toggle uses functional updater, deps reduced
- **Search shows deleted items** — added `soft_deleted` filter for tasks, leads, and finance in command palette search
- **Sync on token refresh** — auth handler now only triggers full sync on `SIGNED_IN`, not every token refresh
- **Sync throttle after re-init** — `destroySyncManager` now resets `lastSyncAt` so first sync isn't skipped
- **InlinePopover z-index** — replaced invalid `z-[var(--layer-popover)]` Tailwind class with inline style
- **Toast stale action** — reads `toastAction` from store at click time instead of stale closure
- **Milestone mark-paid** — added missing `project_id` to SELECT query
- **Content drafts validation** — added `str()` length validation and error check on update, `soft_deleted=false` guard
- **Focus manual PUT** — added `soft_deleted=false` guard to prevent resurrecting deleted items (both online and offline)
- **Billing type switch** — switching between subscription/project now clears incompatible fields (both online and offline)

## [2.29.4] - 2026-04-06

### Fixed
- **RLS soft-delete policy** — remove `soft_deleted = false` from SELECT policies on ai_agents and ai_conversations to allow soft-delete UPDATEs
- **DELETE error handling** — add error checks on leads, tasks, clients, and finance_transactions soft-delete operations (previously always returned success)
- **Milestone rollback hard DELETE** — changed `.delete()` to `.update({ soft_deleted: true })` when rolling back failed milestone creation
- **Agent tool permissions** — `[]` (no tools) no longer maps to `null` (all tools); split `buildFilteredToolsPrompt` for correct empty vs null handling
- **Stream reader leak** — add `reader.releaseLock()` in finally blocks for Ollama and SSE streaming paths
- **Ollama tool args crash** — wrap `JSON.parse(args)` in try/catch with `{}` fallback
- **Ollama refresh hang** — add `.catch()` to model refresh fetch to reset loading state on failure
- **Error responses cached** — `cacheSet()` now rejects `status >= 400`, preventing stale errors from being served
- **SYNC_TABLES incomplete** — add `ai_agents` and `ai_conversations` to sync manager for offline→online sync
- **TABLE_TO_PATH incomplete** — add 5 missing tables to `useRealtimeRefresh` for SWR cache invalidation
- **Chart income tax mismatch** — income with exclusive tax mode now includes tax in chart aggregation, matching stat cards
- **CSV formula injection** — finance export now sanitizes strings starting with `=+\-@\t\r` characters
- **Virtual list layout overlap** — `TransactionList` now uses `measureElement` for dynamic row heights instead of fixed 56px estimate
- **Virtual list bounds crash** — `ClientList` adds `if (!c) return null` guard when virtualizer index exceeds filtered array
- **TaskCard date input** — extract date-only via `slice(0, 10)` for `type="date"` input when due has time component
- **BottomSheet RAF leak** — `requestAnimationFrame` now cancelled via `cancelAnimationFrame` on cleanup
- **Settings import store rehydration** — call `useSettingsStore.setState()` after writing to localStorage during data restore
- **Auth refresh race** — add `refreshing` guard to prevent concurrent `refreshSession()` calls on rapid online events
- **Sign-out UI reset** — reset `activeTab`, `commandPaletteOpen`, and toast on sign-out via `useUIStore`
- **MonthlyGoal division safety** — explicit `goal > 0` check before division
- **Toast safe-area** — use `max()` with `env(safe-area-inset-bottom)` for notched mobile devices
- **CountdownWidget timezone** — use consistent local-midnight calculation
- **Offline numeric fallbacks** — add `|| 0` / `?? 0` for numeric fields in offline PUT handlers (clients, finance, milestones)
- **Offline finance client_id** — add `|| null` fallback matching supabase-api.ts
- **Client projects tax_mode** — validate via `enumVal()` instead of raw `|| 'none'`
- **Request body stream** — use `input.clone().json()` in interceptor to avoid consuming original stream
- **HomeMemoSection UTC date** — use local `toDateStr()` instead of `toISOString().slice(0,10)`
- **Undo-delete scope** — preserve original task scope on undo instead of defaulting to 'work'
- **Keyboard shortcuts in contentEditable** — skip shortcuts when focused on contentEditable elements
- **Sync manager queue length** — read actual queue length after sync instead of hardcoded 0

### Changed
- **Agent section theme support** — replace inline background/border styles with `divide-y` pattern for cross-theme compatibility
- **prefers-reduced-motion** — disable `highlight-pulse` and `skeleton-bone` animations when user prefers reduced motion
- **Avatar onload race** — handle synchronous image load via `img.complete` check

---

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
