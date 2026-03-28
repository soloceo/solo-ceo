<div align="center">

# 一人CEO / Solo CEO

**做自己人生的 CEO — 工作 + 生活一站式管理**

**Be the CEO of Your Life — Work + Life in One Platform**

[![Version](https://img.shields.io/badge/version-2.4.0-blue?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-brightgreen?style=flat-square)]()
[![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)]()

[**立即使用 / Try Now**](https://soloceo.github.io/solo-ceo/)

</div>

---

## 🇨🇳 中文

### 什么是一人CEO？

一人CEO 是专为**独立创业者、自由职业者、Solo Founder** 打造的 Web 管理平台。

不只是管理工作——是管理你的整个人生。工作任务、个人待办、公司收支、个人支出、销售线索、客户管理，全部在一个界面中。

### 核心模块

| 模块 | 说明 |
|------|------|
| **总览** | 关键指标 + AI 今日重点 + 每日原则（19条）+ 每日协议（7步）+ 突围清单 + 可配置小工具 |
| **任务** | 工作/个人双 Tab。工作：看板+泳道双视图；个人：AI 拆解大任务为小步骤 |
| **线索** | 销售漏斗看板 + AI 线索质量分析 + AI 生成开发信（中英双语，3种语气） |
| **客户** | 签约客户管理，订阅制/项目制，阶段款追踪，税务配置 |
| **收支** | 公司/个人双 Tab。AI 记账（自然语言输入）+ 趋势图表 + CSV 导出 |

### AI 能力

所有 AI 功能支持 **Gemini / Claude / OpenAI** 三大模型，在设置中配置 API Key 即可使用：

- **AI 记账** — "吃饭花了20" → 自动解析分类、金额、日期
- **AI 创建任务** — "给Aegis设计logo，高优先级" → 自动匹配客户和优先级
- **AI 拆解任务** — "搬家" → 5-8个可执行小步骤，减少拖延
- **AI 开发信** — 根据线索信息生成个性化邮件，支持正式/友好/直接三种语气
- **AI 线索分析** — 一键批量评估线索质量（高/中/低）

### 特色

- **极简实用** — 无多余装饰，专注信息密度和操作效率
- **工作 + 生活** — 任务和收支都分工作/个人，一个 APP 管理全部
- **离线优先** — PWA 架构，断网可用，恢复后自动同步
- **云端同步** — Supabase 实时同步，跨设备数据一致
- **中英双语** — 完整 i18n 支持
- **深色模式** — 系统级适配
- **数据安全** — 一键 JSON 备份/恢复，CSV 全模块导出
- **智能提醒** — 浏览器通知到期任务

### 使用方式

访问 [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/) 即可使用。支持 PWA 添加到主屏幕。

---

## 🇺🇸 English

### What is Solo CEO?

Solo CEO is a web platform for **solo entrepreneurs, freelancers, and indie founders** to manage both work and life.

Not just work management — it's life management. Work tasks, personal todos, business finance, personal expenses, sales leads, client management — all in one interface.

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | KPIs + AI daily focus + Principles (19) + Protocol (7 steps) + Breakthrough + Widgets |
| **Tasks** | Work/Personal tabs. Work: Kanban + Swimlane; Personal: AI task breakdown into small steps |
| **Leads** | Sales funnel + AI lead quality analysis + AI outreach email generation (3 tones) |
| **Clients** | Client management, subscription/project billing, milestone payments, tax config |
| **Finance** | Business/Personal tabs. AI bookkeeping (natural language) + charts + CSV export |

### AI Capabilities

All AI features support **Gemini / Claude / OpenAI** — configure your API key in Settings:

- **AI Bookkeeping** — "lunch $20" → auto-parses category, amount, date
- **AI Task Creation** — "design logo for Aegis, high priority" → auto-matches client and priority
- **AI Task Breakdown** — "move house" → 5-8 actionable steps to reduce procrastination
- **AI Outreach** — Generate personalized emails based on lead info (formal/friendly/direct)
- **AI Lead Analysis** — Batch-analyze all leads for quality scoring (high/medium/low)

### Highlights

- **Minimalist & practical** — No decoration, pure information density
- **Work + Life** — Tasks and finance split into work/personal tabs
- **Offline-first** — PWA, works without internet, auto-syncs on reconnect
- **Cloud sync** — Supabase real-time sync across devices
- **Bilingual** — Full Chinese/English i18n
- **Dark mode** — System-level adaptation
- **Data safety** — One-click JSON backup/restore, CSV export for all modules
- **Smart reminders** — Browser notifications for due tasks

### How to Use

Visit [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/). Supports PWA install on home screen.

---

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **State**: Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Offline**: sql.js (in-browser SQLite) + Service Worker (PWA)
- **AI**: Gemini / Claude / OpenAI (user-provided API key)
- **Animation**: Motion (Framer Motion)
- **Charts**: Recharts
- **CI/CD**: GitHub Actions → GitHub Pages

## License

**Proprietary — All Rights Reserved**

Copyright (c) 2025-2026 Solo CEO

本软件的源代码仅供查看和参考。未经书面许可，禁止复制、修改、分发或用于任何商业/非商业用途。
详见 [LICENSE](./LICENSE) 文件。

This source code is publicly visible for reference only. Copying, modifying, distributing, or using
this software for any purpose is strictly prohibited without written permission.
See the [LICENSE](./LICENSE) file for details.
