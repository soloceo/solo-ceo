<div align="center">

# Solo CEO

**The all-in-one workspace for solo entrepreneurs**

[![Version](https://img.shields.io/badge/version-2.29.3-blue?style=flat-square)]()
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-brightgreen?style=flat-square)]()
[![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)]()

[**Live App**](https://soloceo.github.io/solo-ceo/) · [**Changelog**](./CHANGELOG.md)

</div>

---

Solo CEO is a web-based workspace built for **solo entrepreneurs, freelancers, and indie founders** who need to manage clients, tasks, leads, finance, and daily routines in one place — with AI assistance, offline support, and real-time cloud sync.

## Modules

| Module | What it does |
|--------|-------------|
| **Dashboard** | Revenue KPIs, AI-powered daily focus, daily protocol with streaks, knowledge base (19 principles), configurable widget system |
| **Leads** | 5-stage sales funnel kanban (New → Contacted → Proposal → Won → Lost), AI lead scoring, AI outreach email drafts |
| **Tasks** | Work kanban (4-column drag-and-drop) + Personal checklist + Work Memo (quick notes with week calendar), AI task breakdown |
| **Clients** | Subscription & project billing, milestone payments with finance linking, subscription timeline, per-client tax config |
| **Finance** | Income/expense tracking, AI bookkeeping (natural language input), trend charts, CSV export |
| **AI Chat** | Streaming AI assistant with full business context injection, page-aware answers, markdown rendering, quick prompts |
| **Settings** | Profile, appearance (themes), AI provider config, language, currency, timezone, data backup |

## AI

All AI features work with **Gemini, Claude, OpenAI, and DeepSeek** — bring your own API key.

- **AI Chat** — Ask questions about your business data; answers are context-aware based on the current page
- **AI Bookkeeping** — Type "lunch $20" and it auto-parses category, amount, and date
- **AI Task Creation** — "design logo for Aegis, high priority" auto-matches client and priority
- **AI Task Breakdown** — Splits a task like "move house" into 5-8 actionable subtasks
- **AI Outreach** — Generates personalized emails from lead data (formal / friendly / direct)
- **AI Lead Scoring** — Batch quality scoring across your pipeline (high / medium / low)
- **AI Memo** — "meeting with client Wed 2pm" extracts title + datetime automatically

## Theme System

Solo CEO ships with a dual-layer theme engine: **7 color palettes** and **5 visual styles** that combine freely.

### Color Palettes

| Palette | Accent | Vibe |
|---------|--------|------|
| Default | Yellow | Notion-inspired warm white |
| Ocean | Blue | Linear-inspired clean |
| Rose | Pink | Soft and warm |
| Forest | Green | Natural earth tones |
| Midnight | Indigo | Deep and immersive |
| Mono | Gray | Pure black and white |
| Google | Google Blue | Authentic Google Workspace |

### Visual Styles

| Style | Character |
|-------|-----------|
| **Classic** | Rounded corners, soft shadows, clean lines |
| **Neo Brutal** | Bold 2px borders, hard offset shadows, high contrast |
| **Glass** | Frosted blur, translucent surfaces, layered depth |
| **HUD** | Cockpit glow, monospace type, scanline texture, terminal aesthetic |
| **Material** | Borderless elevation, MD3 shape scale, Google-spec state layers |

Every combination works in both light and dark mode. All 5 styles include dedicated overrides for every component in the app, including the AI Chat panel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React 19 · TypeScript 5 · Vite 6 · Tailwind CSS v4 |
| **State** | Zustand (persisted to localStorage) |
| **Backend** | Supabase (PostgreSQL · Auth · Realtime · RLS) |
| **Offline** | sql.js (in-browser SQLite) · IndexedDB write queue · Service Worker |
| **Drag & Drop** | @dnd-kit/core · @dnd-kit/sortable |
| **Animation** | Motion (Framer Motion) · spring physics · iOS easing curves |
| **Charts** | Recharts |
| **AI** | Multi-provider streaming (Gemini / Claude / OpenAI / DeepSeek) |
| **CI/CD** | GitHub Actions → GitHub Pages |

## Key Features

- **Offline-first** — Full PWA with in-browser SQLite; works without internet, auto-syncs on reconnect
- **Real-time sync** — Supabase Realtime pushes changes across devices instantly
- **Work + Life** — Tasks and finance split into work and personal tabs
- **Bilingual** — Complete Chinese and English localization
- **Dark mode** — Light / Dark / Auto, with OLED-optimized dark surfaces
- **35 theme combos** — 7 palettes x 5 styles, all with full component-level overrides
- **Data portability** — JSON backup/restore, CSV export for tasks and transactions
- **Mobile-optimized** — Bottom nav, pull-to-refresh, swipe tabs, safe-area support, 44px touch targets

## Getting Started

Visit [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/) — install as a PWA from your browser for a native app experience.

## License

**Proprietary Software** — Copyright (c) 2025-2026 Solo CEO

Source code is publicly visible for reference only. See [LICENSE](./LICENSE) for full terms.
