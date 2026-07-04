<div align="center">

# 派活儿 · Paihuo

**领导把活儿甩给你，你把活儿派给 AI**

一个 Chrome MV3 侧边栏插件，帮助不太会用 AI 的打工人自动拆解任务、选择合适的工具、配现成提示词、写日报周报。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/paihuo?label=Chrome)](https://chrome.google.com/webstore)
![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)
[![Open Issues](https://img.shields.io/github/issues/konglingye/paihuo)](https://github.com/konglingye/paihuo/issues)

[✨ 特性](#-核心特性) • 
[🚀 快速开始](#-快速开始) • 
[📖 文档](#-文档) • 
[🤝 贡献](#-贡献) • 
[📝 License](#-license)

</div>

---

## 为什么选择派活儿？

你可能正在用 ChatGPT、Claude、Kimi……但面临的问题是：

- 🤔 **不知道用哪个工具** — 写文案该用豆包还是 Kimi？改 PPT 该用 Claude 还是 GPT？
- 💭 **不知道怎么问** — 总是问不出想要的答案，浪费时间修改提示词
- 😴 **用着用着就忘了** — 只在被逼时才想起来用 AI，大量工作还在手工做

**派活儿来帮你**：任务倒进来 → AI 自动拆解 → 推荐最合适的工具 + 现成提示词 → 一键打开聊天。省时间，更省力。

---

## ✨ 核心特性

- **🎯 任务智能拆解** — 把模糊的需求拆成清单，标注每件事该用哪个 AI 工具
- **💡 提示词即开即用** — 预置 16+ 工具的提示词模板，用户只填空
- **📋 工作流闭环** — 从「倒活」到「派活」到「写日报」，一个面板走通全天
- **🔐 完全私密** — 无后端无账号，数据全存本地浏览器，用你自己的 API key
- **⚡ 4 个智能体** — 任务拆解官、整理官、小派助手、日报官，各司其职

---

## 📸 界面一览

**[👉 打开交互式原型](docs/prototype.html)** 在浏览器中体验完整设计

### 核心三个界面

| 总览 | 活儿 | 汇报 |
|-----|-----|-----|
| 进度 + 截止提醒 + 成果统计 | 倒活输入 + 任务卡 + 关联建议 | 选模板 + AI 秒写日周月报 |

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm
- Chrome / Edge 浏览器

### 本地加载（开发者）

```bash
# 1. 克隆 + 安装
git clone https://github.com/konglingye/paihuo.git
cd paihuo
pnpm install

# 2. 启动开发服务
pnpm dev
# 输出：.wxt/chrome-mv3/

# 3. Chrome 加载扩展
# 打开 chrome://extensions
# 开发者模式 → 加载已解包的扩展程序 → 选择 .wxt/chrome-mv3
```

### 连接 AI（3 步）

1. **选平台** — DeepSeek / Kimi / 自定义 API
2. **粘 key** — 你的 API key（用你自己的额度）
3. **连接** — 拉取模型列表，选推理模型

**💡 Tip** — 用 `VITE_PAIHUO_MOCK=1 pnpm dev` 跑 mock 模式，不消耗真实额度。

---

## 🏗️ 技术设计

派活儿的核心是 **Agent Harness**——一个完整的浏览器内 AI 智能体系统。

```
用户交互 → AgentRun(profile, input)
    ↓
[提示词装配] → [上下文管理] → [Agent Loop] → [工具执行] → [trace 记录]
    ↓
所有数据存 chrome.storage.local（无后端）
```

**四个智能体各司其职**：
- 📌 **拆解官** — 把模糊指派拆成可交付任务
- 🔗 **整理官** — 发现能合并推进的活儿
- 💬 **小派** — 聊进度、教做法、改状态
- 📄 **汇报官** — 秒写日报、周报、月报

完整设计见 [`docs/02-agent-architecture.md`](docs/02-agent-architecture.md)

### 技术栈

WXT • React 18 • TypeScript • Tailwind • Zustand • Zod • Vitest + Playwright

---

## 📖 文档

| 文档 | 说明 |
|-----|------|
| [**README**](README.md) | 项目介绍（你在这儿） |
| [**CONTRIBUTING**](CONTRIBUTING.md) | 如何贡献代码 |
| [**产品规格**](docs/00-product-spec.md) | 完整功能定义 + 数据模型 |
| [**开发计划**](docs/01-dev-plan.md) | 任务清单与进度 |
| [**架构设计**](docs/02-agent-architecture.md) | Agent Harness 深度解析 |
| [**交互原型**](docs/prototype.html) | 在浏览器打开看完整设计 |

---

## 🧪 测试

```bash
pnpm test              # 单元测试（Vitest）
pnpm eval              # 评测套件（mock fixtures）
pnpm lint              # 代码检查
pnpm type-check        # 类型检查
```

---

## 🤝 贡献

欢迎 Issue、PR、反馈！

### 开发工作流

```bash
pnpm dev               # 启动（自动热刷新）
pnpm test --watch      # 监听测试
# 改代码 → commit → push
```

### 代码风格

- TypeScript strict mode
- 提示词改动需过快照测试
- 新工具需配单测覆盖

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📝 License

MIT License — 完全开源，自由使用、修改、分发。

---

## 📞 获取帮助

- 📖 **完整文档** — [`docs/`](docs/)
- 🐛 **报告问题** — [GitHub Issues](https://github.com/konglingye/paihuo/issues)
- 💬 **讨论功能** — [GitHub Discussions](https://github.com/konglingye/paihuo/discussions)

---

<div align="center">

**派活儿** · 帮打工人把活儿派给 AI  
Made with ❤️ by Kong

</div>
