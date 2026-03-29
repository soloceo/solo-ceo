# Cowork 协作规范

> 本文件供 Cowork（审查/检查 Agent）读取，确保修改后 Code Agent 能顺畅发布到 GitHub。

---

## 1. 不要创建或修改的文件

| 文件 | 原因 |
|------|------|
| `.github/workflows/*.yml` | CI/CD 配置由 Code 维护，只有一个 `deploy.yml`，不要新建第二个 |
| `package-lock.json` | 已从 repo 移除（本机是 ARM，CI 是 x64，lock file 会导致平台冲突） |
| `package.json` 的 `version` 字段 | 版本号由 Code 在发布时递增 |

## 2. 不要删除的文件

| 文件 | 原因 |
|------|------|
| `.github/workflows/deploy.yml` | 唯一的 CI 部署配置 |
| `src/vite-env.d.ts` | TypeScript 类型声明（PWA、版本号等） |
| `src/app/providers.tsx` | 包含 PWA 更新提示组件 |

## 3. 设计规范（保持一致性）

### Tab 按钮（工作/个人 切换）
- **样式**：outline 边框，不用 color-mix 背景光晕
- **选中态**：彩色边框 + 彩色文字/图标（工作=`--color-accent` 金色，个人=`--color-info` 蓝色）
- **未选中**：`--color-border-primary` 边框 + `--color-text-tertiary` 文字

### AI 输入框
- **样式**：标准 `input-base`，无背景色包裹层
- **Bot 图标**：彩色（金色=工作/公司，蓝色=个人）
- **发送按钮**：`btn-primary compact`

### 颜色
- 不要硬编码 `#fff`、`#000` — 使用 `var(--color-text-on-color)` 等 CSS 变量
- 深色模式会自动适配，前提是用 CSS 变量

### 组件
- 不要重新创建已存在的组件（如 WidgetStore、QuickCreateMenu）
- 拆分组件时确保导入路径正确

## 4. 修改后的自检清单

提交前请确认：
- [ ] `npm run build` 本地通过
- [ ] 没有创建新的 `.yml` workflow 文件
- [ ] 没有生成或修改 `package-lock.json`
- [ ] Tab/AI 输入框遵循 outline 设计风格
- [ ] 没有硬编码颜色值

## 5. 发布流程

**Cowork 不负责发布。** 修改完成后通知用户，用户会让 Code Agent 执行：
1. Bump `package.json` version
2. `npm run build`
3. `git commit` + `git push origin main`
4. `git tag` + `git push origin <tag>`
5. GitHub Actions 自动部署
6. 重启 dev server
