<div align="center">

# Solo CEO

**The all-in-one workspace for solo entrepreneurs**

[![Version](https://img.shields.io/badge/version-2.18.0-blue?style=flat-square)]()
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-brightgreen?style=flat-square)]()
[![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)]()

[**Live App**](https://soloceo.github.io/solo-ceo/) · [**Changelog**](./CHANGELOG.md)

</div>

---

## What is Solo CEO?

Solo CEO is a web platform for **solo entrepreneurs, freelancers, and indie founders** to manage work and life in one place.

Tasks, clients, sales leads, finance, daily habits — all in a single interface with AI assistance, offline support, and real-time cloud sync.

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI cards, AI daily focus, daily principles (19), daily protocol (7 steps), configurable widgets |
| **Tasks** | Work kanban (4 columns, drag-and-drop) + Personal checklist with AI task breakdown |
| **Leads** | Sales funnel board (5 stages) + AI lead scoring + AI outreach email generation |
| **Clients** | Subscription & project billing, milestone payments, subscription timeline, tax config |
| **Finance** | Business/Personal tabs, AI bookkeeping (natural language), trend charts, CSV export |
| **Work Memo** | Quick notes with week calendar strip, date/time support, AI quick-add |

## AI Features

All AI features support **Gemini · Claude · OpenAI · DeepSeek** — bring your own API key:

- **AI Bookkeeping** — "lunch $20" → auto-parses category, amount, date
- **AI Task Creation** — "design logo for Aegis, high priority" → matches client + priority
- **AI Task Breakdown** — "move house" → 5–8 actionable steps
- **AI Outreach** — Personalized emails from lead info (formal / friendly / direct)
- **AI Lead Scoring** — Batch quality analysis (high / medium / low)
- **AI Memo** — "meeting with client Wed 2pm" → extracts title + datetime

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| **State** | Zustand |
| **Backend** | Supabase (PostgreSQL · Auth · Realtime) |
| **Offline** | sql.js (in-browser SQLite) · Service Worker (PWA) |
| **DnD** | @dnd-kit/core · @dnd-kit/sortable |
| **Animation** | Motion (Framer Motion) · iOS 26 Liquid Glass easing system |
| **Charts** | Recharts |
| **CI/CD** | GitHub Actions → GitHub Pages |

## Key Features

- **Work + Life** — Tasks and finance split into work / personal tabs
- **Offline-first** — PWA architecture, works without internet, auto-syncs on reconnect
- **Real-time sync** — Supabase Realtime across devices
- **Bilingual** — Full Chinese / English i18n
- **Dark mode** — System-level + manual toggle, OLED-optimized dark theme
- **Data safety** — JSON backup/restore, CSV export for all modules
- **iOS 26 motion** — Liquid Glass easing curves, spring-from-source animations
- **Zero warnings** — Clean React 19 console, no legacy library issues

## Getting Started

Visit [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/) — supports PWA install on home screen.

## License

**Proprietary — All Rights Reserved**

Copyright (c) 2025–2026 Solo CEO

This source code is publicly visible for reference only. Copying, modifying, distributing, or using this software for any purpose is strictly prohibited without written permission. See the [LICENSE](./LICENSE) file for details.
