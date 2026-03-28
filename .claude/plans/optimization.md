# 优化计划

## 1. 修复 APP 同步连接问题
**问题**: 手机浏览器能访问 Mac 服务器，但 Capacitor APP 里连接失败
**原因**: `CapacitorHttp: { enabled: true }` 使 Capacitor 在原生层拦截所有 fetch 请求，与 interceptor.ts 的 monkey-patch 冲突。同步函数 `testSyncUrl`/`syncFromMac`/`syncToMac` 使用完整 URL（如 `http://192.168.x.x:3000/api/...`），被 CapacitorHttp 拦截后处理方式不同于浏览器标准 fetch
**修复**:
- 在 `capacitor.config.ts` 中去掉 `CapacitorHttp: { enabled: true }`，让 fetch 走标准 WebView 路径
- 保留 `androidScheme: 'http'` 和 `cleartext: true` 确保 HTTP 请求不被阻止
- iOS 端需要在 Info.plist 添加 `NSAppTransportSecurity > NSAllowsArbitraryLoads = true` 允许 HTTP

## 2. iOS 顶部/底部安全区重叠
**问题**: iPhone 状态栏（时间/信号）和 APP 头部重叠，底部导航栏和系统横条重叠
**原因**: iOS WebView 需要在 Info.plist 配置 `UIViewControllerBasedStatusBarAppearance` 和在 viewport meta 上设置正确参数。当前的 CSS `env(safe-area-inset-top)` 依赖 viewport-fit=cover 生效
**修复**:
- 检查 iOS 项目的 storyboard/WebView 配置，确保 `edgesForExtendedLayout` 包含 top
- 在 capacitor.config.ts 中添加 iOS 配置：`ios: { contentInset: 'always' }` 或确保 WebView 扩展到安全区
- 确保 `--mobile-header-pt` 在 iOS 平台正确设置为 `max(env(safe-area-inset-top), 48px)`（增大最小值确保不被遮挡）

## 3. 看板拖拽优化
**问题**: 销售看板和任务看板在所有显示模式下检查拖拽是否正常工作
**修复**:
- 在 vertical 视图中，确保 `DragDropContext` 正确包裹所有列
- 在 drag handle 上确保 `touchAction: 'none'` 已设置（当前已有）
- 移动端滚动容器 `overflow-x-auto` 可能干扰拖拽，需要在拖拽时临时禁用滚动
- 水平泳道视图没有拖拽功能，只有 select 下拉切换列 — 这是正常的设计

## 4. 移动端表单横向滑动修复
**问题**: 部分表单在移动端整体可以左右滑动
**修复**:
- 给所有 modal 的容器添加 `overflow-x-hidden`
- 检查 `grid grid-cols-2` 在窄屏下是否导致溢出，必要时在移动端改为 `grid-cols-1`
- 给 textarea 和 input 添加 `max-w-full` 防止溢出
- 在 modal 内容区添加 `overflow-x-hidden` class

## 5. 头像同步
**问题**: 头像存在 localStorage，不参与跨设备同步
**修复**:
- 在 server.ts 的 `/api/sync/export` 中添加 `settings` 字段，包含 operator_name 和 operator_avatar
- 在 server.ts 的 `/api/sync/import` 中处理 `settings` 字段
- 在 `src/db/api.ts` 的 `exportAllData` / `importAllData` 中同样处理 settings
- 同步后触发 `operator-avatar-updated` 和 `operator-name-updated` 事件

## 6. 导航分类、命名和顺序优化
**当前桌面侧栏**:
- 工作台: 今日聚焦, 任务看板, 数据总览
- 业务管理: 客户管理, 销售线索, 财务记账
- 工具箱: AI 内容助手, 产品定价, 系统设置

**优化后桌面侧栏**:
- 日常工作: 今日聚焦, 任务看板
- 客户与销售: 销售线索, 客户管理
- 经营管理: 财务记账, 数据总览, 产品定价
- 工具: 内容工坊, 系统设置

**优化后移动端底部栏**:
- 今日, 任务, 销售, 客户, 更多
- 更多: 财务记账, 数据总览, 内容工坊, 产品定价, 系统设置

**改动理由**:
- 把"销售线索"提到底部 Tab（比"账务"更高频）
- "客户管理"和"销售线索"合为一组（业务漏斗逻辑）
- "数据总览"下移到经营管理（低频查看）
- "AI 内容助手"改名"内容工坊"更清晰
- "产品定价"归入经营管理更合理

## 7. AI 内容工坊 UI 重设计（类 Claude 对话式界面）
**当前**: 左侧控制面板 + 右侧输出区域的分栏布局
**目标**: 类似 Claude 的对话式交互界面

**新设计**:
- 顶部: 平台选择器（水平 pill 栏，可滑动）
- 中间: 聊天式消息流
  - 用户消息气泡（输入的话题/指令）
  - AI 回复气泡（生成的文案、封面建议、图片）
  - 每个 AI 回复底部有操作按钮（复制、保存草稿、确认文案）
- 底部: 输入区域
  - textarea 输入框 + 发送按钮
  - 输入框上方: 快捷操作 pills（搜索热点话题、生成封面建议、生成图片）
  - 语言切换（中/英）集成在输入区域
- 右侧（桌面端）: 可折叠的草稿列表面板

**消息类型**:
- `user`: 用户输入的话题
- `copy`: AI 生成的文案
- `visual`: 封面建议
- `image`: AI 生成的图片

**交互流程**:
1. 用户选择平台 → 输入话题 → 发送
2. AI 回复文案（可编辑、复制、确认）
3. 用户点击"生成封面建议"→ AI 回复封面方案
4. 用户点击"生成图片"→ AI 回复图片（可下载）

## 执行顺序
1. 修复 APP 同步连接 + 头像同步
2. iOS 安全区修复
3. 移动端表单横向滑动修复
4. 导航优化
5. 看板拖拽优化
6. AI 内容工坊 UI 重设计

所有改完后通过 Preview 窗口验证，用户确认后再打包。
