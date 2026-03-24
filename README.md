<div align="center">

# 一人CEO / Solo CEO

**独立创业者的全能管理工具**

**All-in-One Management Tool for Solo Entrepreneurs**

[![Release](https://img.shields.io/github/v/release/soloceo/solo-ceo?style=flat-square)](https://github.com/soloceo/solo-ceo/releases)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20macOS%20%7C%20iOS%20%7C%20Android-blue?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-brightgreen?style=flat-square)]()

[**在线使用 / Try Online**](https://soloceo.github.io/solo-ceo/) · [**下载安装包 / Download**](https://github.com/soloceo/solo-ceo/releases)

</div>

---

## 🇨🇳 中文

### 什么是一人CEO？

一人CEO 是专为**独立创业者 / 自由设计师 / Solo Founder** 打造的一站式经营管理工具。

一个人 = 销售 + 交付 + 财务 + 运营，这个 App 把所有环节整合在一个界面中，让你专注于创造价值。

### 核心功能

| 模块 | 说明 |
|------|------|
| **今日总览** | MRR + 总收入 + 今日入账 + AI 推荐今日重点 + 每日协议 + 突围进度 + 知识库 |
| **任务管理** | 四阶段看板（待办→进行中→待审核→已完成），AI 任务拆解 + MJ 提示词 + 品牌故事 |
| **客户管理** | 销售线索看板 + 签约客户列表，订阅制/项目制统一管理，付款时间线 + 里程碑 |
| **收支统计** | 单表架构，订阅收入自动生成，税务计算（加税/含税），趋势图表，CSV 导出 |
| **设置** | 账号安全（改密码/改邮箱），头像云端同步，中英双语，深色/浅色模式 |

### 亮点特性

- **销售工具面板** — 4 套邮件模板（中英双语）+ 6 个话术场景 + AI 文案生成（8 大平台）
- **订阅时间线** — 支持无限次暂停/恢复，计费日跟随开始日
- **税务系统** — 加税/含税模式，实时预览税前→税额→含税合计
- **里程碑一键记账** — 创建时勾选"已收到"，自动生成财务记录
- **PWA 离线支持** — 浏览器断网也能用，恢复后自动同步
- **云端同步** — Supabase 实时同步，多设备数据一致
- **新用户引导** — 欢迎卡片 + 快捷操作入口

### 下载安装

| 平台 | 方式 |
|------|------|
| **Web（推荐）** | 直接访问 [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/)，支持离线 |
| **macOS** | 下载 `.dmg` → 拖入 Applications |
| **Android** | 下载 `.apk` → 直接安装 |
| **iOS** | 通过 Xcode / TestFlight |

---

## 🇺🇸 English

### What is Solo CEO?

Solo CEO is an all-in-one business management tool built for **solo entrepreneurs, freelance designers, and indie founders**.

One person = sales + delivery + finance + operations. This app brings every part of your business into a single interface.

### Features

| Module | Description |
|--------|-------------|
| **Dashboard** | MRR + Revenue + Today's Income + AI-powered daily focus + Protocol + Breakthrough + Knowledge |
| **Tasks** | 4-stage Kanban (To Do → In Progress → Review → Done), AI task breakdown + MJ prompts |
| **Clients** | Lead pipeline + Signed clients, Subscription/Project billing, Payment timeline + Milestones |
| **Finance** | Single-table architecture, Auto-generated subscription income, Tax calculations, Charts, CSV export |
| **Settings** | Account security, Avatar cloud sync, Bilingual (中/EN), Dark/Light mode |

### Highlights

- **Sales Toolkit** — 4 email templates (bilingual) + 6 script scenarios + AI copy generation (8 platforms)
- **Subscription Timeline** — Unlimited pause/resume cycles, billing date follows start date
- **Tax System** — Exclusive/inclusive tax, real-time preview (base → tax → total)
- **One-click Milestone Payment** — Check "already paid" on creation, auto-generates finance record
- **PWA Offline Support** — Works in browser even without internet, auto-syncs on reconnect
- **Cloud Sync** — Supabase real-time sync across all devices
- **Onboarding** — Welcome card + quick action shortcuts for new users

### Download

| Platform | Method |
|----------|--------|
| **Web (Recommended)** | Visit [soloceo.github.io/solo-ceo](https://soloceo.github.io/solo-ceo/) — offline capable |
| **macOS** | Download `.dmg` → Drag to Applications |
| **Android** | Download `.apk` → Install directly |
| **iOS** | Via Xcode / TestFlight |

---

## 技术栈 / Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Offline**: sql.js (IndexedDB) + Service Worker (PWA)
- **Desktop**: Electron (macOS)
- **Mobile**: Capacitor (iOS + Android)
- **AI**: Gemini API (content generation)

## 平台支持 / Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Web (PWA) | ✅ | GitHub Pages, offline ready |
| macOS (Apple Silicon) | ✅ | Electron, DMG |
| Android | ✅ | Capacitor, APK |
| iOS | ✅ | Capacitor, requires Xcode |

## ⚖️ License

**Proprietary — All Rights Reserved / 专有软件 — 保留所有权利**

Copyright (c) 2025-2026 Solo CEO

本软件的源代码仅供查看和参考。未经书面许可，禁止复制、修改、分发或用于任何商业/非商业用途。
详见 [LICENSE](./LICENSE) 文件。

This source code is publicly visible for reference only. Copying, modifying, distributing, or using
this software for any purpose is strictly prohibited without written permission.
See the [LICENSE](./LICENSE) file for details.
