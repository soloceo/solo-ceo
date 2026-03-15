<div align="center">

# 一人CEO / Solo CEO

**独立创业者的全栈工作台**

**All-in-One Workspace for Solo Entrepreneurs**

[![Release](https://img.shields.io/github/v/release/soloceo/solo-ceo?style=flat-square)](https://github.com/soloceo/solo-ceo/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20iOS%20%7C%20Android-blue?style=flat-square)]()

</div>

---

## 🇨🇳 中文

### 什么是一人CEO？

一人CEO 是专为**独立创业者 / 自由设计师 / Solo Founder** 打造的一站式经营管理工具。

一个人 = 销售 + 交付 + 财务 + 运营 + 内容，这个 App 把所有环节整合在一个界面中，让你专注于创造价值，而不是在多个工具之间切换。

### 核心功能

#### 📊 首页仪表盘
- 今日重点（AI 自动推荐 + 手动记录）
- MRR、活跃客户、潜客、进行中任务一目了然
- 最近活动时间线

#### 🎯 销售看板（商机）
- 四阶段看板：待联系 → 沟通中 → 发送提案 → 已成交
- 拖拽移动，AI 生成开发信
- 一键转化为客户

#### 👥 客户管理
- 订阅制 / 项目制客户统一管理
- 自动计算生命周期收入、年度收入
- 客户状态：活跃 / 暂停 / 已取消

#### ✅ 任务看板
- 四阶段看板：待办 → 进行中 → 待审核 → 已完成
- AI 任务规划：输入项目类型，自动拆解子任务
- 优先级筛选，拖拽排序

#### 💰 财务管理
- 收入 / 支出流水记录
- 订阅收入自动生成（基于客户 MRR）
- 套餐管理，月度报表导出
- 收支趋势图表

#### ✨ AI 内容工坊
- 8 大平台文案生成：X / LinkedIn / Newsletter / Cold Email / Instagram / 微信 / 小红书 / Blog
- 中英双语，一键复制
- 草稿保存与管理

#### ⚙️ 设置
- 运营者信息、头像
- 深色 / 浅色模式
- 中文 / English 双语切换
- API Key 管理（Gemini / OpenAI / Anthropic）

### 快速开始

#### 安装
从 [Releases](https://github.com/soloceo/solo-ceo/releases) 下载最新版本：
- **macOS (Apple Silicon)**: 下载 `.dmg` 文件，拖入 Applications 即可
- **Android**: 下载 `.apk` 文件直接安装
- **iOS**: 需通过 Xcode 构建安装

#### 开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打包 macOS
npm run electron:pack

# 发布新版本到 GitHub Releases
npm run release
```

#### 环境变量
创建 `.env` 文件：
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 🇺🇸 English

### What is Solo CEO?

Solo CEO is an all-in-one business management tool built for **solo entrepreneurs, freelance designers, and indie founders**.

As a one-person team, you are sales + delivery + finance + operations + content — all at once. This app brings every part of your business into a single interface, so you can focus on creating value instead of switching between multiple tools.

### Features

#### 📊 Dashboard
- Today's Focus (AI-powered recommendations + manual notes)
- Key metrics at a glance: MRR, active clients, leads, tasks in progress
- Recent activity timeline

#### 🎯 Sales Pipeline (Leads)
- 4-stage Kanban board: To Contact → In Discussion → Proposal Sent → Closed Won
- Drag & drop cards, AI-generated outreach emails
- One-click conversion from lead to client

#### 👥 Client Management
- Unified management for subscription & project-based clients
- Auto-calculated lifetime revenue and annual revenue
- Client status: Active / Paused / Cancelled

#### ✅ Task Board
- 4-stage Kanban board: To Do → In Progress → In Review → Done
- AI task planning: enter a project type, get auto-generated subtasks
- Priority filters, drag & drop sorting

#### 💰 Finance
- Income & expense transaction records
- Auto-generated subscription income (based on client MRR)
- Plan management, monthly report export
- Revenue & expense trend charts

#### ✨ AI Content Studio
- Generate copy for 8 platforms: X / LinkedIn / Newsletter / Cold Email / Instagram / WeChat / Xiaohongshu / Blog
- Bilingual (Chinese & English), one-click copy
- Draft saving & management

#### ⚙️ Settings
- Operator info & avatar
- Dark / Light mode
- Chinese / English language toggle
- API Key management (Gemini / OpenAI / Anthropic)

### Quick Start

#### Install
Download the latest version from [Releases](https://github.com/soloceo/solo-ceo/releases):
- **macOS (Apple Silicon)**: Download the `.dmg` file, drag to Applications
- **Android**: Download the `.apk` file and install directly
- **iOS**: Build via Xcode

#### Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build macOS app
npm run electron:pack

# Publish new version to GitHub Releases
npm run release
```

#### Environment Variables
Create a `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 技术架构 / Tech Stack

```
Frontend:  React 19 + TypeScript + Tailwind CSS 4 + Motion
Data:      Supabase (PostgreSQL + Auth + Realtime + RLS)
Desktop:   Electron (macOS)
Mobile:    Capacitor (iOS + Android)
AI:        Google Gemini API
```

### 云同步 / Cloud Sync
```
Component → fetch("/api/*") → Supabase Interceptor → Supabase Cloud
                                                   ↓ (offline)
                                              Local sql.js + Queue Replay
```

- **实时同步 / Real-time Sync**: 多设备秒级同步 / Multi-device sync in seconds (Supabase Realtime)
- **离线支持 / Offline Support**: 断网可用，恢复后自动同步 / Works offline, auto-syncs when back online
- **数据隔离 / Data Isolation**: RLS 行级安全 / Row-Level Security per user
- **自动更新 / Auto Update**: Mac App 内置更新检测 / Built-in update detection (electron-updater)

## 平台支持 / Platform Support

| 平台 / Platform | 状态 / Status | 说明 / Notes |
|------|------|------|
| macOS (Apple Silicon) | ✅ | Electron, auto-update supported |
| iOS | ✅ | Capacitor, requires Xcode |
| Android | ✅ | Capacitor, APK available |
| Web | ✅ | Vite dev server |

## 许可证 / License

Private — All Rights Reserved
