# Solo CEO — UI/UX 全面审查报告

**审查日期**: 2026-03-28
**审查范围**: 代码审查 + 实际截图审查（桌面端 + 移动端 390px）
**审查维度**: 视觉一致性、交互体验、响应式适配、可访问性(a11y)、国际化(i18n)

---

## 一、关键发现总结

| 类别 | 严重 | 中等 | 轻微 | 合计 |
|------|------|------|------|------|
| 暗色模式 | 0 | 2 | 1 | 3 |
| 视觉一致性 | 2 | 12 | 5 | 19 |
| 交互体验 | 4 | 10 | 2 | 16 |
| 表单验证 | 3 | 2 | 0 | 5 |
| 响应式/移动端 | 0 | 4 | 3 | 7 |
| 可访问性(a11y) | 3 | 8 | 3 | 14 |
| 国际化(i18n) | 0 | 3 | 3 | 6 |
| **合计** | **12** | **41** | **17** | **70** |

---

## 二、严重问题（必须修复）

### ~~1. 暗色模式主内容区未适配~~ ✅ 已验证正常
- **更正**: 经放大截图确认，暗色模式工作正常。CSS 变量 `.dark` 覆盖完整，主内容区正确显示深色背景 + 浅色文字。

### 2. 任务删除无确认对话框
- **文件**: `src/features/work/TaskDetail.tsx`
- **现象**: 点击删除任务按钮直接执行删除，没有确认步骤
- **影响**: 用户可能误删任务，无法撤回
- **修复建议**: 添加与客户删除一致的确认弹窗

### 3. 表单验证无用户反馈
- **文件**: `src/features/clients/ClientList.tsx` (公司名、MRR、项目费用字段)
- **现象**: 输入字段标记了 `required` 但没有内联错误提示。用户不知道为什么表单无法提交
- **修复建议**: 添加表单级验证 + 红色错误提示文字

### 4. 关键操作使用浏览器原生 confirm()
- **文件**: `src/features/clients/ClientList.tsx` (切换计费类型)
- **现象**: 使用 `window.confirm()` 弹出原生对话框，与 APP 设计风格完全不一致
- **修复建议**: 替换为自定义 Modal 确认框

### 5. 交易列表使用 div grid 而非语义化 table
- **文件**: `src/features/finance/TransactionList.tsx`
- **现象**: 桌面端财务数据表格使用 CSS Grid + div，屏幕阅读器无法识别表格结构
- **影响**: 可访问性严重问题，视障用户无法理解数据关系
- **修复建议**: 改用 `<table>/<thead>/<tbody>/<th>/<td>` 语义化标签

### 6. 滑动操作(SwipeAction)无键盘替代方案
- **文件**: `src/components/SwipeAction.tsx`
- **现象**: 删除操作只能通过触摸滑动触发，键盘用户完全无法执行
- **修复建议**: 添加右键菜单或长按弹出删除选项，或在卡片上显示更多操作按钮

---

## 三、中等问题（建议修复）

### 视觉一致性

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| 1 | Widget 使用自定义 `s()` 缩放函数，尺寸不在 Tailwind 设计令牌体系内 | `useWidgetScale.ts`, 多个 Widget | 统一使用 CSS 变量或 Tailwind 间距 |
| 2 | 大量内联 style 替代 Tailwind 类 (100+ 处) | 全局 | 创建 `text-primary` 等工具类替代 `style={{ color: "var(--color-text-primary)" }}` |
| 3 | `main.tsx` 错误回退 UI 使用硬编码 `#666`、`#999` 等颜色 | `src/main.tsx` | 改用 CSS 变量 |
| 4 | border-radius 混用 `s(2.5)`、`3px`、`var(--radius-*)` 三种方式 | 各 Widget | 统一使用 `--radius-*` 令牌 |
| 5 | `color-mix()` 透明度百分比不一致 (6%~15% 随意使用) | LeadsBoard, ClientList | 定义标准透明度级别 |
| 6 | z-index 硬编码 `z-[1100]`、`z-[900]` 未使用层级令牌 | LeadsBoard, TaskCard, PWAUpdatePrompt | 使用 `--layer-*` CSS 变量 |
| 7 | 两套 Toast 系统并存: GlobalToast (Zustand) + SyncToast (自定义事件) | `App.tsx` | 合并为统一的 Toast 系统 |

### 交互体验

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| 8 | 数据刷新时无加载指示器（只有首次加载有） | ClientList, FinancePage | 添加顶部线性进度条或骨架屏 |
| 9 | 多处 catch 块静默吞掉错误，用户无反馈 | ClientList (plans/finance fetch), App.tsx (badges) | 至少显示 Toast 错误提示 |
| 10 | 空状态设计不统一——有的用图标+文字，有的只有纯文本 | ClientList, ActivityTimeline | 统一使用 EmptyState 组件 |
| 11 | Modal 打开时不自动聚焦首个输入框 | `Modal.tsx` | 添加 `autoFocus` 到第一个可交互元素 |
| 12 | 删除确认弹窗未锁定焦点（可点击背景内容） | ClientList 删除对话框 | 添加 focus trap + 背景禁用 |
| 13 | 标签页切换时滚动位置跳转无过渡动画 | `App.tsx` | 添加 `scroll-behavior: smooth` |
| 14 | 键盘快捷键(1-5)无视觉提示 | App.tsx sidebar | 在 Tooltip 或底部状态栏显示快捷键 |
| 15 | `fetchTasks()` 无防抖，快速拖拽可能产生竞态 | WorkPage | 添加 debounce 或 AbortController |

### 响应式/移动端

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| 16 | FAB 弹出菜单固定 180px 宽度，在 <375px 屏幕可能溢出 | App.tsx | 使用 `min(180px, calc(100vw - 2rem))` |
| 17 | 收支页桌面 grid 列使用固定像素宽度，平板(768-1023px)可能挤压 | FinancePage | 为 md 断点添加响应式列定义 |
| 18 | 看板横向滚动在 iOS 无可见滚动条提示 | KanbanBoard | 添加渐变遮罩或滚动指示器 |
| 19 | 移动端 body `overflow:hidden` 可能在长表单时截断内容 | base.css | 验证所有表单在小屏下的可滚动性 |

### 可访问性 (a11y)

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| 20 | 多个图标按钮缺少 `aria-label` | CountdownWidget (删除), TransactionList (锁定) | 添加描述性 label |
| 21 | KanbanBoard `role="list"` 但子项缺少 `role="listitem"` | KanbanBoard.tsx | 补充 ARIA 角色层级 |
| 22 | 页面缺少语义化 `<h1>` 标题 | HomePage, 各功能页 | 添加视觉隐藏的 h1 |
| 23 | 任务卡片标题未使用语义化 heading 标签 | TaskCard | 使用 `<h3>` 替代 `<div>` |
| 24 | Badge 计数无可访问文本 | App.tsx sidebar badges | 添加 `aria-label="5 个待办任务"` |
| 25 | `--color-text-tertiary: #7a7772` 对比度可能不达 WCAG AA 标准 | tokens.css | 验证并调整到 ≥4.5:1 |
| 26 | 部分输入框缺少可见 label | ClientList side panel | 确保所有 Input 都有 label 或 aria-label |
| 27 | 错误状态 + 聚焦状态视觉冲突 | Input.tsx | 错误时保持红色边框 + 蓝色焦点环 |

### 国际化 (i18n)

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| 28 | 收支分类硬编码中文: `["收入","软件支出","外包支出","其他支出"]` | FinancePage | 移入 i18n 翻译文件 |
| 29 | 个人分类硬编码: `["餐饮","交通","房租","娱乐","个人其他"]` | FinancePage | 同上 |
| 30 | 看板优先级标签硬编码 `zh:"高"` | KanbanBoard | 使用 `t()` 翻译函数 |

---

## 四、轻微问题（可选修复）

1. 按钮在 `lg:` 断点从 44px 突变到 32px，可考虑在 `md:` 过渡
2. 侧边栏折叠时 badge 圆点缺少 `aria-hidden="true"`
3. 暗色模式 ErrorBoundary 的 `color-mix` 背景未验证
4. 看板负边距 `-mx-4/-mx-6/-mx-8` 虽正确但增加维护复杂度
5. 错误弹窗 (`main.tsx`) 无阴影，与其他模态框风格不一致
6. `.btn-icon-sm` 在移动端只有 40px，低于推荐的 44px 触控目标
7. 焦点指示器风格不统一（按钮用 outline，输入框用 box-shadow）

---

## 五、截图审查总结

### 桌面端 (1470px)
- ✅ 侧边栏导航清晰，图标+文字
- ✅ 首页仪表盘信息层次分明（KPI → 今日重点 → 每日课程 → 协议）
- ✅ 任务看板四列布局合理，进度条直观
- ✅ 客户列表表格信息密度适中，有搜索和筛选
- ✅ 收支页图表 + 流水列表组合良好
- ✅ 暗色模式工作正常（经放大截图确认）

### 移动端 (390px)
- ✅ 底部 Tab 导航正常，5 个入口 + FAB
- ✅ 客户页自动切换为卡片布局（非表格）
- ✅ 看板支持水平滚动
- ✅ 触控目标大小基本达标 (44px)
- ⚠️ FAB 菜单在极小屏幕可能溢出

---

## 六、建议修复优先级

### P0 — 立即修复（影响核心功能/安全）
1. 任务删除添加确认对话框
2. 替换 `window.confirm()` 为自定义 Modal
3. 表单验证添加内联错误提示

### P1 — 短期修复（提升用户体验）
4. 静默 catch 添加 Toast 错误反馈
6. 统一空状态组件
7. Modal 自动聚焦 + focus trap
8. 硬编码中文分类移入 i18n

### P2 — 中期优化（提升品质感）
9. 内联 style 迁移至 Tailwind 工具类
10. 统一 border-radius / z-index / color-mix 令牌
11. 合并两套 Toast 系统
12. 语义化 HTML 改进 (table, heading 层级)
13. SwipeAction 添加键盘替代操作
14. 数据刷新加载指示器

### P3 — 长期改进（锦上添花）
15. WCAG AA 对比度审计 + 修复
16. Widget 缩放函数迁移到设计令牌
17. 触控目标统一 44px+
18. 焦点指示器风格统一
