# 贡献指南

感谢你对派活儿的兴趣！本文档指导如何开发、测试和提交贡献。

## 开发工作流

### 1. 环境准备

```bash
git clone https://github.com/example/paihuo.git
cd paihuo
pnpm install
```

### 2. 本地开发

```bash
pnpm dev
```

扩展会自动编译到 `.wxt/chrome-mv3` 目录。在 Chrome 里加载该目录后，修改代码时面板会自动刷新。

### 3. 调试

- **测试**：`pnpm test --watch`
- **类型检查**：`pnpm type-check`
- **Lint**：`pnpm lint`
- **评测**：`pnpm eval`（用 mock fixtures 跑整链）
- **E2E**：`OPENAI_API_KEY=xxx pnpm playwright`

### 4. 提交前检查清单

```bash
# 确保代码通过所有检查
pnpm lint
pnpm type-check
pnpm test

# 或一键运行
pnpm check
```

## 代码风格

### TypeScript

- strict mode（项目 `tsconfig.json` 已开启）
- 无 `any` 类型
- 工具参数与输出用 Zod schema 定义

### 提示词

**重点**：提示词改动必须通过快照测试审核。

```bash
pnpm test agents/prompts/__snapshots__
```

### 新工具开发

每个新工具需要：
1. `src/agents/tools/xxx.ts` — 工具实现 + Zod schema
2. `src/agents/tools/xxx.test.ts` — 单元测试（handler + 错误路径）
3. `src/agents/profiles/*.ts` — 在对应 profile 的 toolRegistry 中注册

### Commit Message

格式：`<type>(<scope>): <subject>`

```
feat(decomposer): 支持从 PDF 提取结构化数据
fix(orchestrator): 修复对话消息顺序混乱的问题
chore(deps): 升级 React 到 18.3
docs(architecture): 补充上下文压缩算法说明
```

类型：`feat` / `fix` / `chore` / `docs` / `refactor` / `test`

## 工作流约定

### Issue

- **Bug 报告**：用 `.github/ISSUE_TEMPLATE/bug_report.md`
- **功能建议**：用 `.github/ISSUE_TEMPLATE/feature_request.md`
- **讨论**：使用 Discussions 而非 Issue

### Pull Request

1. Fork 本仓库
2. 基于 `main` 创建 feature 分支：`git checkout -b feat/your-feature`
3. 改代码 → 跑测试 → commit
4. 推送到 fork：`git push origin feat/your-feature`
5. 创建 PR，描述要解决的问题 + 解决方案
6. 等待 CI 通过 + code review

### Review 标准

- 逻辑正确、没有隐藏的 bug
- 代码风格一致
- 有测试覆盖
- 提示词改动通过快照测试
- 文档同步更新

## 架构原则

派活儿的设计遵循以下原则，修改时请保持一致：

### 1. Agent Harness 通用性

harness 核心（`loop.ts` / `context.ts` / `tools.ts` / `trace.ts`）保持通用且小（≤900 行），所有业务差异放进 profile 数据与提示词块。

### 2. 工具 effect 系统

每个工具声明 `effect`：`read` / `write` / `ui` / `external`，executor 按此决定执行策略。新工具要清楚地标记 effect。

### 3. 结构化输出契约

所有 LLM 能力的输出都有 zod schema（`outputContract`），失败自动重试 1 次，再失败按降级处理。

### 4. 提示词块模板

内部提示词分六块：`identity` / `tool-policy` / `state` / `contract` / `style` / `memory`，每块首行注释说明存在的理由。改动必须跑快照测试。

### 5. 事件驱动

自动 run（拆解后自动跑整理官、任务完成后轻量检查）都通过事件触发，受同样的预算与 trace 约束，且**不许调 ui/external 工具**。

## 测试策略

### 单元测试（Vitest）

```bash
pnpm test
```

覆盖：
- 工具 schema 校验 + handler 逻辑 + 错误路径
- 提示词块快照（改动时会 diff）
- context 组装与压缩
- trace 完整性

### 评测（Mock Fixtures）

```bash
pnpm eval
```

金标准 fixtures 驱动，断言：
- 拆解：任务数、fit 保守性、提示词空槽、toolId 有效性、due 提取
- 对话：工具调用序列、终局要素
- 压缩：关键未决事项召回

### E2E（真模型）

```bash
OPENAI_API_KEY=sk-xxx pnpm playwright
```

加载扩展、跑脚本化场景（倒活 → 派活 → 对话 → 日报）。

## 文档

更新 `/docs` 里的文档以保持同步：

- `00-product-spec.md` — 产品规格 SSOT（功能、数据模型、Profile 行为契约）
- `01-dev-plan.md` — 开发计划与任务进度
- `02-agent-architecture.md` — Agent Harness 详细设计
- 改动源代码时同步更新对应的架构文档

## 发布流程

本项目采用语义化版本（Semantic Versioning）。发布由维护者负责。

### 版本号格式

- `MAJOR.MINOR.PATCH`（如 v0.1.0）
- MAJOR：架构级改动或不兼容变更
- MINOR：新功能（向后兼容）
- PATCH：bug fix

### 发布前

1. 更新 `CHANGELOG.md`（如果有的话）
2. 更新版本号（`package.json` 中的 `version`）
3. 创建 git tag：`git tag v0.x.y`
4. 推送 tag：`git push origin v0.x.y`

## 快速参考

```bash
# 启动开发
pnpm dev

# 运行测试
pnpm test --watch

# 跑整链评测
pnpm eval

# 格式检查
pnpm lint && pnpm type-check

# 一键检查所有
pnpm check
```

## 问题排查

### 扩展加载失败

- 确保 Chrome 版本 ≥ 121（MV3 要求）
- 检查 `.wxt/chrome-mv3` 目录是否存在
- 尝试 `pnpm dev` 重新构建

### 测试失败

- 清除缓存：`pnpm exec vitest --clearCache`
- 更新快照（如果是提示词改动）：`pnpm test -- -u`
- 检查本地 Node 版本是否 ≥ 18

### 模型连接问题

- 检查 API key 和 base_url 是否正确
- 用 `pnpm dev` 启动 mock 模式测试：`VITE_PAIHUO_MOCK=1 pnpm dev`
- 查看浏览器控制台（F12）的 Network 标签

## 获取帮助

- **文档**：查看 [README](README.md) 和 `docs/` 目录
- **问题反馈**：[GitHub Issues](https://github.com/example/paihuo/issues)
- **讨论**：[GitHub Discussions](https://github.com/example/paihuo/discussions)

---

感谢你的贡献！🎉
