# 派活儿 Paihuo — 项目说明（执行 agent 必读）

浏览器侧边栏插件：帮不太会用 AI 的打工人**拆任务、派给合适的 AI 工具、给现成提示词、聊进度、写日报周报**。Chrome MV3 sidePanel，**无后端**，用户自带 OpenAI 兼容 API key（BYOK）。

## 三份权威文件（冲突时以此为准，从上到下优先级递减）

1. **用户的明确指令**（对话里说的）
2. [`docs/00-product-spec.md`](docs/00-product-spec.md) — 产品规格 SSOT：功能、数据模型、提示词、范围边界
3. [`prototype/paihuo-prototype.html`](prototype/paihuo-prototype.html) — **UI/UX SSOT**：视觉令牌、布局、文案、微交互全部以它为准（用浏览器打开对照着做，配色是「豆包蓝」浅色系，令牌在文件头部 `:root`）

开发顺序与任务定义在 [`docs/01-dev-plan.md`](docs/01-dev-plan.md)，按 **Goal 运行协议**推进。

## Goal 运行协议

循环：**取最低编号的 ready 任务 → 简述方案 → TDD 实现 → 真实验证达 DoD → 在 dev-plan 里勾掉并写一行完成记录（日期+验证方式）→ 取下一个**。

- 验证必须真实：`pnpm dev` 起真实扩展、Playwright 或手动步骤截图，**禁止**只跑单测就宣称完成 UI 任务；禁止用 mock 冒充"真实模型已验证"。
- LLM 相关开发一律先走 **mock 模式**（`VITE_PAIHUO_MOCK=1`，fixtures 在 `src/mocks/`），不花用户的钱。
- 每完成一个任务 git commit（中文 message，`feat/fix/chore(scope): 描述`）。

**遇到以下情况必须停下问用户，不许自作主张**：
- 需要真实 API key、任何要花钱的调用（T17 冒烟测试）
- 商店上架、对外发布、发任何东西到外部服务
- 删除/覆盖用户数据、不可逆操作
- 想做 spec 之外的功能、想换技术栈、与原型/规格冲突的设计取舍
- 同一任务连续失败 3 次

## 技术栈（已锁定，勿换）

`WXT`（MV3 框架）+ React 18 + TypeScript + Tailwind CSS + `zustand`（persist → `chrome.storage.local`）；pnpm；测试 `vitest` + Playwright（加载解包扩展）；文本抽取 `pdfjs-dist` / `mammoth` / `xlsx`。图标一律内联 SVG（Lucide 风格，参照原型 symbol 表），**禁止 emoji 当图标、禁止外链 CDN 资源**。

## 回复语言

始终用简体中文；代码、命令、专有名词保留英文。
