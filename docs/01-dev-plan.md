# 派活儿 · 开发计划（Goal 运行手册）v2.0

> 执行者：Claude（Sonnet 5）持续循环。协议见 `CLAUDE.md`；产品语义见 `docs/00-product-spec.md`；**智能体机制见 `docs/02-agent-architecture.md`（下称 arch）**；UI 对照 `prototype/paihuo-prototype.html`。
> v2.0 变更：按用户要求升级为**完整智能体架构**——统一 harness（agent loop / 工具编排 / 提示词装配 / 上下文管理 / trace / evals），任务清单重排。

## 总目标（Definition of Victory）

可在 Chrome/Edge 开发者模式安装的 MV3 侧边栏插件 zip（v0.1.0）：

1. 用户走完 3 步向导（自己的 key）后，真实完成「倒活→拆解成带工具与提示词的任务卡→复制提示词跳工具→对话盯活→日报周报」。
2. **所有 AI 能力经统一 harness 运行**：多轮工具调用、预算护栏、上下文压缩、`#/trace` 可查每次 run 的逐轮细节；UI 全程可见 agent 在干嘛。
3. mock 模式下 `pnpm e2e` 全链路绿 + `pnpm eval` 评测套件绿。
4. 无后端、权限最小化、spec §9 之外的不做。

## 运行规则（每轮循环）

1. 取**编号最小的未勾选**任务（依赖未满足顺延）。
2. 写 3-5 行方案（UI 看原型；智能体机制看 arch 对应小节）。
3. TDD：harness/工具/上下文/提示词块必须先写测试；纯 UI 允许实现后补 Playwright 断言。
4. 实现 → **真实验证达 DoD** → 勾掉任务并追加 `✅ YYYY-MM-DD 验证方式：…` → git commit。
5. mock 纪律：`VITE_PAIHUO_MOCK=1` 贯穿全程，真 key 只在 T24（停点）。
6. 连败 3 次 / 停点 / 想超 spec → 停下问用户。

## 任务清单

### M0 地基

- [x] **T01 脚手架**：pnpm+WXT+React18+TS+Tailwind+zod；`entrypoints/sidepanel`；manifest 权限按 spec §2。
  DoD：Chrome 加载后侧边栏渲染三 tab 壳；`pnpm build` 零报错。
  ✅ 2026-07-04 验证方式：`pnpm build` 零报错；`pnpm test`（vitest）App 组件冒烟测试通过；用 Playwright 启动真实 Chromium 加载 `.output/chrome-mv3` 解包扩展，直接访问 `sidepanel.html` 截图确认总览/活儿/汇报三 tab 渲染且切换正常，截图存 `docs/qa/T01-sidepanel-*.png`。
- [x] **T02 设计令牌与基础组件**：原型 `:root` 迁入 Tailwind；Button/Pill/Chip/Card/SegmentedTabs/Sheet/Toast/进度环 + 内联 SVG 图标表。
  DoD：dev-only `/components` 页与原型逐块目测一致，截图存 `docs/qa/`。
  ✅ 2026-07-04 验证方式：`src/styles/tokens.css` 迁入原型 `:root` 令牌（Tailwind v4 `@theme`）；`src/components/ui` 落地 8 个基础组件 + `src/components/icons` 原样迁入原型 24 个 `<symbol>` 图标表；`entrypoints/components`（unlisted-page）逐块渲染，`pnpm build` 后用 Playwright 加载真实解包扩展访问 `components.html` 截图逐块比对原型（颜色/圆角/阴影/间距一致），交互验证 Sheet 开合与 Toast 触发，截图存 `docs/qa/T02-components-*.png`；过程中发现并修复一个真实 bug——两个 entrypoint 各自的同内容 CSS 文件被 Vite 去重后文件名不一致导致 `components.html` 引用的 CSS 404（图标退化成实心黑色大图标），改为两个入口共享同一个 `src/styles/global.css` 模块后修复。
- [x] **T03 数据层**：zustand stores（settings/tasks/fragments/groups/reports/ui）+ persist(chrome.storage.local) + schemaVersion 迁移；模型按 spec §4。
  DoD：vitest 覆盖 CRUD/roundtrip/迁移，绿。
  ✅ 2026-07-04 验证方式：`src/store/schema.ts` 按 spec §4 建 zod schema+类型；`src/store/storage.ts` 适配 `chrome.storage.local`（`wxt/testing` 的 `fakeBrowser` 驱动测试）；六个 store（settings/tasks/fragments/groups/reports 走 persist，ui 为纯瞬态不落盘）均 TDD 先写测试再实现；`pnpm test` 8 个文件 34 个用例全绿，覆盖 CRUD、"模拟重启扩展"式 persist roundtrip、以及 tasksStore 的 schemaVersion 0→1 迁移（`savedMinutes`→`saveMin` 改名）；`pnpm compile` 与 `pnpm build` 均零报错。
- [x] **T04 LLM 传输层**：OpenAI 兼容 SSE 流式（经 background service worker 代发解 CORS）、AbortSignal、错误分类（401/429/超时）、usage 采集；mock 通道读 `src/mocks/` fixtures（含流式分片模拟）。
  DoD：vitest 本地 mock server 断言流式/中断/各错误路径。
  ✅ 2026-07-04 验证方式：`src/llm/transport.ts`（真实 SSE 解析+超时+中断+401/429/未知错误分类）用 Node `http` 本地起 mock server 测试，含跨 write 分包解析；`src/mocks/llm/`（fixtures+分片模拟 mockTransport）与 transport 同接口可互换；`src/llm/protocol.ts`+`background-bridge.ts`+`realTransport.ts` 实现 port 转发协议，用内存假 port 对（还原 chrome.runtime.Port 的 disconnect 语义）端到端测试 start/delta/usage/done/error/abort/并发多请求不串号；`src/llm/client.ts` 按 `VITE_PAIHUO_MOCK` 分流 mock/real；`entrypoints/background.ts` 接入 `registerLlmBackgroundBridge()`；`pnpm test`（12 文件 52 用例）/`pnpm compile`/`pnpm build` 全绿，并用 Playwright 加载真实解包扩展确认 background service worker 启动无报错、侧边栏三 tab 仍正常渲染。

### M1 Harness 核心（arch §1-§4，本里程碑是整个项目的心脏）

- [x] **T05 工具注册与执行器**（arch §2）：ToolRegistry（zod schema→JSON Schema、effect 分级、confirm 门）、ToolExecutor（read 并行/write 串行/超时/结构化错误）；先落任务库 7 个工具 + `search_tool_catalog`。
  DoD：vitest 覆盖每个工具的 schema 校验、handler、错误路径、并行/串行策略。
  ✅ 2026-07-04 验证方式：`src/agents/harness/tools.ts` 实现 ToolRegistry（zod→JSON Schema 用 zod v4 原生 `toJSONSchema`）+ `executeToolCalls`（连续 read 批量并行/write 严格串行、ui/external 默认拒绝需 `allowUiExternal`、超时、未知工具、schema 校验失败、handler 抛错均归为结构化错误不炸 run），13 个用例含计时断言验证并行/串行策略；新增 `relationsStore`（`link_tasks` 落点，TDD 4 用例）；`src/agents/tools/tasks.ts` 落地 7 个任务库工具（list/get/create/update/complete_task + group_tasks + link_tasks），16 个用例覆盖 schema/handler/错误路径；`src/agents/tools/catalog.ts` + `src/assets/tools.json` 种子目录（3 条，完整 16 项清单与 URL 核验留给 T12）实现 `search_tool_catalog`，6 个用例覆盖类型过滤/关键词排序/空结果/封闭目录约束；`pnpm test`（16 文件 91 用例）/`pnpm compile`/`pnpm build` 全绿。
- [ ] **T06 Agent Loop**（arch §1）：多轮工具调用循环、maxTurns/每轮工具数/token 上限护栏、空转检测、结构化输出契约（zod 校验+1 次修复重试+降级路径）、AbortController、Trace 记录（arch §6 数据结构）。
  DoD：vitest 用脚本化 mock LLM 断言：多轮工具链、超轮次兜底、契约修复、中断、trace 完整性。
- [ ] **T07 上下文管理器**（arch §3）：token 估算、状态快照块（任务板一行一任务）、附件摘录+`read_attachment` 分块、历史窗口+滚动摘要压缩。
  DoD：vitest：超预算触发压缩且未决事项保留（压缩 eval fixture）；快照块随 store 变化。
- [ ] **T08 提示词装配器**（arch §4）：六块模板（identity/tool-policy/state/contract/style/memory）+ 四个 profile 的块组合与参数；快照测试锁定；`#/trace` dev 页（run 列表+逐轮展开）。
  DoD：`pnpm test` 快照绿；mock 下手动跑一次 decomposer run，在 `#/trace` 能看到完整装配与逐轮记录。

### M2 接上 AI

- [ ] **T09 设置向导**：3 步 UI 照原型；预设与注册链接（spec §3.4）；`/models` 探测回退；推理模型识别置顶+自动选中+非推理警告；测试连接三态（成功/401/429）。
  DoD：mock 下 Playwright 走完全流程；错误态文案与"回设置"引导齐全。

### M3 核心循环：倒活→拆解→派活

- [ ] **T10 内容与知识工具**：`read_attachment`（txt/md/pdf/docx/csv/xlsx 解析→分块）、附件白名单校验 UI、`get_prompt_template`、`draft_user_prompt`、`draft_message`。
  DoD：解析器 fixture 单测；传 `.exe` 被拒 toast；分块读取单测。
- [ ] **T11 拆解官链路**：decomposer profile（契约=spec §6.1 schema）接倒活 UI：思考态流光两段文案（来自 loop 流式事件）→ 骨架 → 任务卡逐张入场；空槽【…】高亮渲染。
  DoD：mock 下点「拆解」产出与原型一致的 4 卡；契约校验失败走降级卡路径（单测）。
- [ ] **T12 工具目录与卡片动作**：`assets/tools.json`（spec §5）+ `pnpm check:tools` URL 核验脚本；「复制提示词 · 打开工具」（clipboard+tabs）、「复制小抄」、「标记完成」动效。
  DoD：check:tools 全绿；Playwright 断言复制内容与开 tab（mock tabs）。
- [ ] **T13 整理官与筛选**：organizer profile（事件触发，见 T17 前先手动触发）产关联建议→横幅；类型筛选 chips+计数；分组头三态。
  DoD：mock 下筛「演示」只剩 PPT 卡；关联横幅出现/可关/进对话。

### M4 盯活：小派 orchestrator

- [ ] **T14 主对话 agent**：orchestrator profile 接对话 UI（dock+抽屉+流式+建议 chips+附件消息）；`dispatch` 委派（深度≤1）；ui 工具（reveal_card/notify/open_tool_site 含用户手势门）；**活动指示**（状态短句实时来自工具调用，arch §6）。
  DoD：mock 剧本：「会议纪要发完了」→ complete_task 划卡+进度环；「PPT 怎么开始」→ 3 步教学+跳卡高亮；乱输入→友好兜底。trace 里能回放该 run。
- [ ] **T15 长期记忆**：`remember/recall` 工具 + 用户画像块（800 字上限+淘汰）+ 工作日志（每日摘要，90 天滚动）+ 会话次日归档。
  DoD：单测：记忆写入→下次 run 的 system 记忆块可见；日志生成正确。
- [ ] **T16 总览页**：spec §3.1 全区块动态化 + 空态 + 跳转。
  DoD：拆解前后数字/类型/到期全随 store 变化，Playwright 断言。
- [ ] **T17 事件编排**：EventBus + 规则表（arch §5）：dump.created→decomposer→organizer 链、task.completed→轻量建议、17:30 alarm→日报提醒；自动 run 禁 ui/external 工具。
  DoD：单测触发规则；mock 下完成任务后出现"建议下一件"。

### M5 报活

- [ ] **T18 汇报官**：reporter profile（契约=spec §6.4）+ 模板上传解析注入 + 流式输出 + 复制/下载 .md + ReportRecord 落库；数据来自 `query_task_history` + 工作日志。
  DoD：mock 下三种报告可生成、模板改变结构、下载内容正确。

### M6 质量与收口

- [ ] **T19 评测套件**（arch §7）：`pnpm eval`——拆解 6 fixtures 断言（fit 保守/空槽/目录内 toolId/due）、对话脚本断言工具序列、压缩召回断言。
  DoD：mock 通道全绿；真模型通道留待 T24。
- [ ] **T20 右键收集与快捷键**：contextMenus 选中文本→倒活框；`Cmd/Ctrl+Shift+Y`。
  DoD：手动验证记录；权限未超集。
- [ ] **T21 打磨**：空态/错误态/429 引导全检、reduced-motion、360-420px 自适应、文案对照原型校对；`docs/qa/checklist.md` 完稿打勾。
- [ ] **T22 e2e**：Playwright 加载解包扩展，mock 全链路（配置→倒活→拆解→筛选→对话→汇报→重启数据仍在→trace 有记录）。
  DoD：`pnpm e2e` 一条命令绿。
- [ ] **T23 打包**：`pnpm zip` 产 Chrome/Edge 包；README 安装图文+用户版「3 步接 AI」指南；v0.1.0。
  DoD：干净实例安装跑通 mock 链路。

### 停点（必须先问用户）

- [ ] **T24 ⛔ 真 key 冒烟 + 真模型评测**：要 DeepSeek key → 真模型跑 e2e 主链路 + `pnpm eval` 真模型档，人工过一遍输出记分，迭代提示词（契约不变）。
- [ ] **T25 ⛔ 商店上架**：Edge Add-ons 优先；素材/隐私声明/账号由用户定。

## 里程碑验收

M1 完 = 智能体心脏可跑（mock 多轮工具调用 + trace）；M3 完 = 核心价值可演示；M4 完 = 盯活闭环且 agent 全程可见；M6 完 + T24 过 = 可发真实用户。

## 风险备忘

- 各平台 `/models` 与鉴权差异 → 探测回退 + 手填模型名降级。
- CORS → 一律 background 代发（T04 定死）。
- token 估算不准 → usage 校准 + 预算留 30% 余量。
- 工具目录 URL 过期 → `check:tools` 纳入 e2e 前置。
- pdfjs/mammoth 体积 → 动态 import。
- harness 过度设计风险 → 核心四文件目标 ≤900 行，超了先简化再加功能。
