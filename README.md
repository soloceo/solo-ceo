<div align="center">

# 一人CEO

**独立创业者的全栈工作台**

Solo Entrepreneur Operating System

[![Release](https://img.shields.io/github/v/release/soloceo/solo-ceo?style=flat-square)](https://github.com/soloceo/solo-ceo/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20iOS%20%7C%20Android-blue?style=flat-square)]()

</div>

---

## 什么是一人CEO？

一人CEO 是专为**独立创业者 / 自由设计师 / Solo Founder** 打造的一站式经营管理工具。

一个人 = 销售 + 交付 + 财务 + 运营 + 内容，这个 App 把所有环节整合在一个界面中，让你专注于创造价值，而不是在多个工具之间切换。

## 核心功能

### 📊 首页仪表盘
- 今日重点（AI 自动推荐 + 手动记录）
- MRR、活跃客户、潜客、进行中任务一目了然
- 最近活动时间线

### 🎯 销售看板（商机）
- 四阶段看板：待联系 → 沟通中 → 发送提案 → 已成交
- 拖拽移动，AI 生成开发信
- 一键转化为客户

### 👥 客户管理
- 订阅制 / 项目制客户统一管理
- 自动计算生命周期收入、年度收入
- 客户状态：活跃 / 暂停 / 已取消

### ✅ 任务看板
- 四阶段看板：待办 → 进行中 → 待审核 → 已完成
- AI 任务规划：输入项目类型，自动拆解子任务
- 优先级筛选，拖拽排序

### 💰 财务管理
- 收入 / 支出流水记录
- 订阅收入自动生成（基于客户 MRR）
- 套餐管理，月度报表导出
- 收支趋势图表

### ✨ AI 内容工坊
- 8 大平台文案生成：X / LinkedIn / Newsletter / Cold Email / Instagram / 微信 / 小红书 / Blog
- 中英双语，一键复制
- 草稿保存与管理

### ⚙️ 设置
- 运营者信息、头像
- 深色 / 浅色模式
- 中文 / English 双语
- API Key 管理（Gemini / OpenAI / Anthropic）

## 技术架构

```
前端: React 19 + TypeScript + Tailwind CSS 4 + Motion
数据: Supabase (PostgreSQL + Auth + Realtime + RLS)
桌面: Electron (macOS)
移动: Capacitor (iOS + Android)
AI:   Google Gemini API
```

### 云同步架构
```
Component → fetch("/api/*") → Supabase Interceptor → Supabase Cloud
                                                   ↓ (离线时)
                                              本地 sql.js + 队列回放
```

- **实时同步**: 多设备秒级同步（Supabase Realtime）
- **离线支持**: 断网可用，恢复后自动同步
- **数据隔离**: RLS 行级安全，每个用户只能访问自己的数据
- **自动更新**: Mac App 内置更新检测（electron-updater）

## 快速开始

### 1. 安装
从 [Releases](https://github.com/soloceo/solo-ceo/releases) 下载最新版本：
- **macOS (Apple Silicon)**: 下载 `.dmg` 文件

### 2. 开发
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

### 3. 环境变量
创建 `.env` 文件：
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| macOS (Apple Silicon) | ✅ | Electron，支持自动更新 |
| iOS | ✅ | Capacitor，需 Xcode 构建 |
| Android | ✅ | Capacitor，需 Android Studio 构建 |
| Web | ✅ | Vite dev server |

## 许可证

Private — All Rights Reserved
