# 派活儿 · Paihuo

> 领导把活儿甩给你，你把活儿派给 AI。

一个 Chrome MV3 侧边栏插件，帮助不太会用 AI 的打工人**自动拆解任务、选择合适的 AI 工具、用上现成的提示词、写日报周报**。无后端、无账号、BYOK（自带 API key）。

## ✨ 核心功能

### 五动词工作流

- **倒活** · 文本、文件、语音多形态输入。支持粘贴 PDF、Word、Excel
- **派活** · AI 自动拆成清单，标注能帮多少、该用哪个工具、第一句话说什么
- **盯活** · 与小派对话改状态、教做法、发现能合并的活儿
- **报活** · AI 秒写日报、周报、月报。量化省时时间
- **循环** · 完成任务 → 写日报 → 倒新活儿。一个工作流走通全天的节奏

### 核心特性

✅ **无后端** · 所有数据存本机浏览器（`chrome.storage.local`）  
✅ **BYOK** · 用你自己的 API key、自己的额度。从不内置开发者的 key  
✅ **隐私优先** · 没有云、没有账号、没有追踪  
✅ **工具聚合** · 16+ 个智能体工具：任务库、工具目录、提示词模板、对话、记忆、汇报  
✅ **侧边栏常驻** · Chrome MV3 sidePanel，随处可得  

## 📸 界面预览

👉 **[打开交互式原型](docs/prototype.html)**（在浏览器中查看完整设计）

或下载 [`docs/prototype.html`](docs/prototype.html) 在本地浏览器打开。

**功能预览**：
- **总览 Tab**：问候语 + 进度环 + 按类型计数 + 截止时间提醒 + 今日成果
- **活儿 Tab**：倒活输入框 + 任务卡列表 + 关联建议横幅  
- **汇报 Tab**：上传模板 + AI 写日报 + 生成输出
- **对话（小派）**：dock 快捷 chips + 消息流 + 实时回复

---

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- pnpm
- Chrome / Edge 浏览器

### 安装

\`\`\`bash
# 1. 克隆仓库
git clone https://github.com/konglingye/paihuo.git
cd paihuo

# 2. 安装依赖
pnpm install

# 3. 本地开发构建
pnpm dev
# 输出：.wxt/chrome-mv3/ 目录
\`\`\`

### 在 Chrome 里加载

1. 打开 \`chrome://extensions\`
2. 右上角打开「开发者模式」
3. 「加载已解包的扩展程序」→ 选择 \`.wxt/chrome-mv3\` 目录
4. Chrome 工具栏会多出派活儿图标，点击打开侧边栏

### 接上 AI

1. 派活儿设置 → 选平台（DeepSeek / Kimi / 自定义 API）
2. 粘 API key → 连接
3. 拉取模型列表 → 完成

**💡 Tip**：用 \`VITE_PAIHUO_MOCK=1 pnpm dev\` 跑 mock 模式（不消耗真实 API）

## 🏗️ 技术架构

### Agent Harness（核心）

派活儿是一个**完整的浏览器内 AI 智能体系统**，所有 LLM 能力都过同一个 harness 运行——统一循环、统一工具、统一上下文、统一观测。UI 组件**禁止**裸调 chat completions。

详见 [docs/02-agent-architecture.md](docs/02-agent-architecture.md)

### 技术栈

- **框架**：WXT (MV3)
- **UI**：React 18 + TypeScript
- **样式**：Tailwind CSS
- **状态**：Zustand (persist → chrome.storage.local)
- **校验**：Zod (工具参数 + 输出契约)
- **测试**：Vitest + Playwright
- **文本处理**：pdfjs-dist / mammoth / xlsx

## 📂 目录结构

\`\`\`
src/agents/
├─ harness/           # Agent Loop / Context / Tools / Trace
├─ profiles/          # 四个 Profile
├─ prompts/           # 提示词块
├─ tools/             # 工具实现
├─ memory/            # 用户画像 / 工作日志
└─ events.ts          # 事件编排

src/components/       # React UI
src/mocks/            # Mock fixtures
src/assets/           # tools.json

evals/                # 金标准评测
docs/                 # 文档
prototype/            # UI 原型
\`\`\`

## 🧪 测试

### 单元测试

\`\`\`bash
pnpm test              # 跑 vitest
pnpm test --ui        # 打开测试 UI
\`\`\`

### 评测

\`\`\`bash
pnpm eval              # 用 mock fixtures 跑整链评测
\`\`\`

### E2E（需要 API key）

\`\`\`bash
OPENAI_API_KEY=sk-xxx OPENAI_BASE_URL=xxx pnpm playwright
\`\`\`

## 📖 文档

- [README](README.md) — 项目介绍
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南
- [docs/00-product-spec.md](docs/00-product-spec.md) — 产品规格
- [docs/01-dev-plan.md](docs/01-dev-plan.md) — 开发计划
- [docs/02-agent-architecture.md](docs/02-agent-architecture.md) — 智能体架构设计

## 🤝 贡献

欢迎 issue、PR、反馈和改进建议！详见 [CONTRIBUTING.md](CONTRIBUTING.md)

### 开发工作流

1. \`pnpm dev\` 启动本地扩展
2. 改代码 → Chrome 自动刷新
3. \`pnpm test --watch\` 跑单测
4. 提交前：\`pnpm lint && pnpm type-check\`

## 📝 License

MIT License — 自由使用、修改、分发。详见 [LICENSE](LICENSE) 文件。

## 📞 支持

- 📖 [文档](docs/)
- 🐛 [Issue](https://github.com/konglingye/paihuo/issues)
- 💬 [Discussions](https://github.com/konglingye/paihuo/discussions)

---

**派活儿** · 帮打工人把活儿派给 AI  
Made with ❤️ by Kong
