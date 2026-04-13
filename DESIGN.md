# Solo CEO Design System — Default Theme

## 1. Visual Theme & Atmosphere

Solo CEO is a single-operator business workspace built for focus and clarity. The default theme channels Notion's flat, typographic approach — clean white surfaces, warm charcoal text, and near-invisible shadows that keep the eye on content rather than chrome. The interface reads like a well-organized notebook: structured, spacious, and deliberately undecorated.

Solo CEO Yellow (`#f5c518`) is the singular accent color — warm, confident, and unmistakable. It marks primary actions, progress indicators, and active states. Everything else is a four-level greyscale hierarchy that maintains strict separation between primary content and supporting metadata. The result is a workspace that feels calm during routine tasks but sharpens into focus when decisions need to be made.

Dark mode inverts the palette into a near-black workspace (`#191919`) with reduced-contrast text (`#ffffffcf`), designed for late-night sessions without eye strain.

**Key Characteristics:**
- Notion-inspired flat surfaces — no gradients, no decorative patterns
- Solo CEO Yellow (`#f5c518`) as the sole accent, driving all primary actions
- Warm charcoal text (`#37352f`) with 4-level typographic hierarchy
- Near-invisible shadows (4-8% opacity) — depth is communicated by border, not shadow
- System font stack (SF Pro / PingFang SC) — no custom fonts, CJK-optimized
- Tabular numerals globally — financial data always aligns
- 6px base radius — rounded but not bubbly

## 2. Color Palette & Roles

### Brand / Accent

| Name | Hex | Role |
|------|-----|------|
| Solo CEO Yellow | `#f5c518` | Primary CTA background, active indicators, accent |
| Accent Text | `#8a6d00` | Text links on light surfaces |
| Accent Hover | `#e0ad00` | Hover state for yellow buttons |
| Accent Tint | `rgba(245,197,24,0.08)` | Subtle yellow background highlights |
| Brand Text | `#1a1400` | Text ON yellow backgrounds (dark for contrast) |

### Surfaces & Backgrounds

| Name | Light | Dark | Role |
|------|-------|------|------|
| Primary | `#ffffff` | `#191919` | Main canvas, card backgrounds |
| Secondary | `#f7f6f3` | `#202020` | Sidebar, alternate rows, subtle grouping |
| Tertiary | `#f1f0ed` | `#2f2f2f` | Hover backgrounds, active tab fills |
| Quaternary | `#e9e8e4` | `#373737` | Pressed states, strong grouping |
| Panel | `#ffffff` | `#202020` | Floating panels, dialogs |
| Translucent | `rgba(55,53,47,0.03)` | `rgba(255,255,255,0.04)` | Overlay tints |

### Text (4-Level Hierarchy)

| Level | Light | Dark | Use |
|-------|-------|------|-----|
| Primary | `#37352f` | `#ffffffcf` | Headings, body text, KPI values |
| Secondary | `#5a5955` | `#ffffff9e` | Descriptions, nav links |
| Tertiary | `#787774` | `#999999` | Labels, metadata, timestamps |
| Quaternary | `#9b9a97` | `#666666` | Placeholder text, disabled labels |

### Borders & Lines

| Name | Light | Dark | Use |
|------|-------|------|-----|
| Border Primary | `rgba(55,53,47,0.09)` | `rgba(255,255,255,0.07)` | Card borders, input borders |
| Border Secondary | `rgba(55,53,47,0.13)` | `rgba(255,255,255,0.11)` | Stronger card outlines |
| Line Secondary | `rgba(55,53,47,0.09)` | `rgba(255,255,255,0.06)` | Dividers, table row borders |
| Line Tertiary | `rgba(55,53,47,0.06)` | `rgba(255,255,255,0.04)` | Subtle section dividers |

### Semantic

| Name | Light | Dark | Use |
|------|-------|------|-----|
| Success | `#0f7b6c` | `#4dab9a` | Positive states, completion, revenue up |
| Warning | `#f5c518` | `#f5c518` | Alerts, pending states |
| Danger | `#e03e3e` | `#e06c6c` | Errors, destructive actions, revenue down |
| Info | `#2383e2` | `#5b9ee9` | Informational badges, links |

### Extended Palette

| Name | Hex | Use |
|------|-----|-----|
| Blue | `#2383e2` | Info badges, chart series |
| Green | `#0f7b6c` | Success badges, chart series |
| Orange | `#d9730d` | Priority High, chart series |
| Purple | `#6940a5` | Tags, chart series |

## 3. Typography Rules

### Font Stack

**Primary:** System font stack optimized for CJK
```
-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
'PingFang SC', 'Microsoft YaHei UI', 'Noto Sans CJK SC',
'Segoe UI', 'Roboto', 'Helvetica Neue', system-ui, sans-serif
```

**Monospace:** `'SF Mono', 'Menlo', ui-monospace, monospace`

### Weight Scale

| Token | Value | Use |
|-------|-------|-----|
| Normal | 400 | Body text, descriptions |
| Medium | 500 | Labels, badges, nav links, buttons |
| Semibold | 600 | Active tabs, section headings |
| Bold | 700 | KPI values, headings, emphasis |

### Size Scale (1.25x ratio)

| Token | Size | Use |
|-------|------|-----|
| xs | 12px | Tags, fine print, badges |
| sm | 13px | Section labels, tab text, KPI labels |
| base | 14px | Body text, descriptions, inputs |
| md | 16px | Prominent body, mobile inputs (zoom prevention) |
| lg | 20px | Card headings, subheadings |
| xl | 25px | Page titles |
| 2xl | 31px | Hero numbers, KPI display values |
| 3xl | 39px | Dashboard hero headlines |

### Line Heights

| Token | Value | Use |
|-------|-------|-----|
| Title | 1.2 | Display / hero headings |
| Heading | 1.25 | Section headings |
| Compact | 1.4 | Cards, dense layouts |
| Body | 1.6 | Paragraph text, descriptions |

### Principles

- `font-variant-numeric: tabular-nums` applied globally — financial data always aligns in columns
- `letter-spacing: -0.02em` on headings — tighter tracking for authority
- `letter-spacing: -0.005em` on body — subtly tighter than browser default
- Antialiased rendering on light mode; auto smoothing on dark mode for legibility
- Section labels: 12px, medium weight, tertiary color — quiet but structured
- Headings use `--font-weight-bold` (700) — confident, never thin

## 4. Component Stylings

### Buttons

**Primary (Yellow Fill)**
- Background: `#f5c518`
- Text: `#1a1400` (dark on yellow for contrast)
- Border: 1px solid transparent
- Radius: `var(--radius-base)` (6px)
- Height: 40px (compact: 36px)
- Padding: 8px 16px
- Hover: background shifts to `#e0ad00`, shadow rises to `--shadow-medium`
- Active: opacity 0.7
- Disabled: opacity 0.4, cursor not-allowed
- Transition: 0.15s cubic-bezier(0.4, 0, 0.2, 1)

**Secondary (Bordered)**
- Background: transparent
- Text: `--color-text-primary`
- Border: 1px solid `--color-border-primary`
- Hover: background fills to `--color-bg-tertiary`
- Active: opacity 0.7

**Ghost (Borderless)**
- Background: transparent
- Text: `--color-text-tertiary`
- Border: 1px solid transparent
- Hover: background fills to `--color-bg-tertiary`, text darkens to primary
- Active: opacity 0.7

**Danger**
- Background: `--color-danger`
- Text: white
- Hover: opacity shift

### Cards & Containers

| Variant | Border | Shadow | Hover |
|---------|--------|--------|-------|
| Flat | 1px solid `--color-border-translucent` | none | — |
| Elevated | 1px solid `--color-border-primary` | `0 1px 2px rgba(0,0,0,0.04)` | — |
| Interactive | 1px solid `--color-border-translucent` | `--shadow-low` | bg shifts to secondary, shadow rises |

- Radius: `var(--radius-base)` (6px) for all cards
- No hover translate (0px) — cards stay grounded
- Transition: 0.15s ease

### Inputs & Forms

- Background: `--color-bg-primary`
- Text: `--color-text-primary`
- Border: 1px solid `--color-border-primary`
- Radius: `var(--radius-base)` (6px)
- Height: 40px (compact: 36px)
- Focus: border shifts to `--color-accent`, ring `0 0 0 3px` accent at 40% opacity
- Placeholder: `--color-text-quaternary`
- Mobile: forced 16px font-size to prevent iOS auto-zoom

### Badges

- Font: 12px, medium weight (500)
- Padding: 2px 8px
- Radius: `var(--radius-base)` (6px)
- Background: `--color-bg-tertiary`
- Color: `--color-text-tertiary`
- Border: none (0px)

### Tabs

- Font: 13px, medium weight
- Padding: 6px 10px
- Radius: 6px
- Inactive: tertiary text, transparent background
- Hover: secondary text, tertiary background
- Active: primary text, semibold weight, tertiary background fill

### Navigation

**Desktop (sidebar)**
- Width: 232px
- Background: `--glass-bg-sidebar` (translucent)
- Sticky, full height

**Mobile (bottom nav)**
- Height: ~56px + safe-area
- Background: `--header-bg` (translucent with backdrop-blur)
- Border-top: `--header-border`

**Header**
- Height: 48px
- Background: `rgba(255,255,255,0.85)` (light) / `rgba(25,25,25,0.85)` (dark)
- Backdrop: `blur(16px) saturate(180%)`
- Border-bottom: subtle 6% opacity line

## 5. Layout Principles

### Spacing System

Base unit: 4px (all spacing is multiples of 4)

| Token | Value | Use |
|-------|-------|-----|
| 4px | 1 unit | Tight inline gaps, icon spacing |
| 8px | 2 units | Component internal padding, small gaps |
| 12px | 3 units | Input padding, card internal margins |
| 16px | 4 units | Standard padding, section margins |
| 20px | 5 units | Page stack gap (mobile), card body padding |
| 24px | 6 units | Page stack gap (desktop), section spacing |
| 32px | 8 units | Major section spacing |
| 48px | 12 units | Header height, large section padding |

### Grid & Container

- Page max-width: 1024px (centered)
- Page inline padding: 24px
- Sidebar width: 232px (desktop only)
- Content max-width for prose: 65ch

### Responsive Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <768px | Bottom nav, stacked layout, 16px input font |
| Tablet/Desktop | >=768px | Larger gaps (24px), bigger KPIs (24px) |
| Desktop | >=1024px | Sidebar nav, full layout |

### Touch Targets

- Minimum: 44px (WCAG AAA)
- Buttons: 40px height (36px compact)
- Bottom nav items: full-width tappable zones
- Interactive cards: full surface tappable

## 6. Depth & Elevation

| Level | Light | Dark | Use |
|-------|-------|------|-----|
| None | none | none | Default cards, inline elements |
| Tiny | `0 0 0 transparent` | `0 0 0 transparent` | Minimal (effectively flat) |
| Low | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | Elevated cards, resting interactive |
| Medium | `0 2px 6px rgba(0,0,0,0.05)` | `0 2px 8px rgba(0,0,0,0.3)` | Hovered cards, floating elements |
| High | `0 4px 12px rgba(0,0,0,0.08)` + ring | `0 4px 16px rgba(0,0,0,0.4)` + ring | Modals, dialogs, command palette |

Solo CEO uses a whisper-light shadow system. Card shadows are at 4-5% opacity — they exist as ground cues, not decorative depth. The philosophy: in a business workspace, heavy shadows feel distracting, while no shadows at all feel flat and cheap. The 4% sweet spot communicates professionalism without drawing attention.

### Glass / Translucent

Header and sidebar use backdrop-blur translucency:
- Blur: `blur(16px) saturate(180%)`
- Background: 85-95% opacity white (light) / near-black (dark)
- Border: 5-6% opacity line

## 7. Border Radius Scale

| Value | Token | Use |
|-------|-------|-----|
| 2px | `--radius-2` | Subtle edge softening, text line decorations |
| 4px | `--radius-4` | Small interactive elements |
| **6px** | **`--radius-base`** | **Default — cards, buttons, inputs, badges, tabs** |
| 8px | `--radius-8` | Slightly larger containers |
| 12px | `--radius-12` | Modal sheets (mobile top corners) |
| 16px | `--radius-16` | Large feature cards |
| 20px | `--radius-20` | Hero containers |
| 24px | `--radius-24` | Full-bleed feature sections |
| 9999px | `--radius-pill` | Icon buttons, avatar circles, pill shapes |

The default theme uses 6px as the universal base radius — rounded enough to feel modern, tight enough to feel professional. Only icon buttons and avatars go full-round.

## 8. Z-Index Layers

| Layer | Value | Use |
|-------|-------|-----|
| Base | 1 | Default stacking |
| Float | 10 | FABs, floating action buttons |
| Header | 100 | Sticky header/nav |
| Overlay | 500 | Backdrop overlays |
| Popover | 600 | Dropdown menus, inline popovers |
| Command Menu | 650 | Cmd+K search palette |
| Dialog | 700 | Modal dialogs |
| Confirm | 710 | Confirmation dialogs (above modals) |
| Toasts | 800 | Notification toasts |
| PWA | 900 | PWA update banner |
| Tooltip | 1100 | Tooltips (topmost) |

Always use `var(--layer-xxx)` tokens. Never hardcode z-index values.

## 9. Motion & Animation

| Property | Value | Use |
|----------|-------|-----|
| Fast | 0.15s | Button hover, input focus, color transitions |
| Normal | 0.2s | Card interactions, tab switches |
| Slow | 0.3s | Panel slides, modal entrances |
| Slower | 0.6s | Page transitions, complex animations |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` | All transitions (iOS-standard curve) |
| Bounce | `cubic-bezier(0.25, 1, 0.5, 1)` | Spring-like overshoots |

**Framer Motion defaults:** `{ stiffness: 320, damping: 30 }` for modals, bottom sheets, toasts.

**Press feedback:** Active state = opacity 0.7, no scale transform. Cards do not translate on hover — they stay grounded.

## 10. Do's and Don'ts

### Do

- Use Solo CEO Yellow (`#f5c518`) exclusively for primary actions and active states — it is the single accent color
- Maintain the 4-level text hierarchy (primary → secondary → tertiary → quaternary) — never skip levels
- Use `tabular-nums` for all numerical displays — financial data must align
- Keep shadows at 4-5% opacity — barely visible, just enough for grounding
- Use `var(--radius-base)` (6px) for cards, buttons, inputs — consistency over variety
- Use `var(--layer-xxx)` tokens for all z-index values
- Apply `max(fallback, env(safe-area-inset-bottom))` for safe-area padding — never raw `env()` alone
- Use the 4px spacing grid — all gaps/margins should be multiples of 4
- Set minimum touch targets to 44px on mobile
- Use `--color-brand-text` (`#1a1400`) for text on yellow backgrounds — high contrast dark text
- Force 16px font-size on mobile inputs to prevent iOS auto-zoom

### Don't

- Don't introduce additional accent colors — yellow is the only brand color; semantic colors (green/red/blue) are for data meaning only
- Don't use heavy shadows or hover-lift effects — this is a calm workspace, not a trading floor
- Don't use radius above 6px on standard cards or buttons — only modals and special containers go larger
- Don't use raw `fetch()` for internal API calls — always use `src/lib/api.ts`
- Don't hardcode z-index values — always use `var(--layer-xxx)` tokens
- Don't set `overflow` on `.mobile-page` elements — it creates implicit scroll containers that break gesture handling
- Don't use `will-change: transform` — it creates compositing layers that intercept scroll events
- Don't use gradient backgrounds on cards — keep surfaces flat and solid
- Don't mix pill-radius (9999px) and base-radius (6px) buttons in the same row
- Don't use colored backgrounds for semantic meaning on cards — use text color or small accent indicators instead
- Don't use font weights below 500 for interactive elements — medium weight minimum for buttons, tabs, and labels

## 11. Agent Prompt Guide

### Quick Color Reference

| Role | Light | Dark |
|------|-------|------|
| Primary CTA | `#f5c518` (yellow bg, `#1a1400` text) | Same yellow, same dark text |
| Surface | `#ffffff` | `#191919` |
| Heading text | `#37352f` | `#ffffffcf` |
| Body text | `#5a5955` | `#ffffff9e` |
| Metadata text | `#787774` | `#999999` |
| Border | `rgba(55,53,47,0.09)` | `rgba(255,255,255,0.07)` |
| Success | `#0f7b6c` | `#4dab9a` |
| Danger | `#e03e3e` | `#e06c6c` |

### Quick Component Reference

- **Card:** white bg, 1px border at 9% opacity, 6px radius, no shadow (flat) or 4% shadow (elevated)
- **Button Primary:** `#f5c518` bg, `#1a1400` text, 6px radius, 40px height, hover darkens to `#e0ad00`
- **Button Secondary:** transparent bg, primary text, 1px border, 6px radius, hover fills tertiary bg
- **Input:** white bg, 1px border, 6px radius, 40px height, focus ring yellow at 40%
- **Badge:** 12px text, 6px radius, tertiary bg/text, 2px/8px padding
- **KPI Value:** 22-24px, bold (700), tabular-nums, primary text
- **Section Label:** 12px, medium (500), tertiary text, uppercase: none

### Example Component Prompts

- "Create a KPI card with white background, 1px border (rgba 9%), 6px radius, no shadow. 13px tertiary label on top, 22px bold primary value below, tabular-nums."
- "Build a primary action button: #f5c518 background, #1a1400 text, 0.875rem/500, 6px radius, 40px height, 8px 16px padding. Hover darkens to #e0ad00."
- "Design a section with a 12px medium-weight tertiary label, followed by a stack of flat cards (6px radius, 1px border) at 20px gap."
- "Create a mobile bottom sheet with 12px top-radius, white background, high shadow, drag handle centered at top."
