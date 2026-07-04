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
- [x] **T06 Agent Loop**（arch §1）：多轮工具调用循环、maxTurns/每轮工具数/token 上限护栏、空转检测、结构化输出契约（zod 校验+1 次修复重试+降级路径）、AbortController、Trace 记录（arch §6 数据结构）。
  DoD：vitest 用脚本化 mock LLM 断言：多轮工具链、超轮次兜底、契约修复、中断、trace 完整性。
  ✅ 2026-07-04 验证方式：为让 loop 真正能调用工具，先扩展 `src/llm/transport.ts` 支持 OpenAI 风格 `tools`/流式 `tool_calls` 累积解析（5 个新用例，含跨分片累积、并发多 tool_calls 不串号）；`src/agents/harness/budget.ts`（token 估算、默认预算常量、空转判定）+ `llmDriver.ts`（把 client 包成 loop 用的 `LlmDriver`，工具参数 JSON 解析失败优雅降级）均 TDD 先测后写；`src/agents/harness/loop.ts` 实现 `runAgent`：多轮工具链、每轮工具数截断、连续两轮空转强制收尾、超 maxTurns 兜底 bailout、结构化输出契约校验失败重试 1 次再失败走 fallback/bailout、401 不重试直接终止/429 退避重试 1 次、AbortSignal 检测、`trace.ts` 记录逐轮 assistantText/toolCalls/usage/durationMs；14 个用例覆盖 DoD 全部场景，一次性全绿；`pnpm test`（19 文件 121 用例）/`pnpm compile`/`pnpm build` 全绿。
- [x] **T07 上下文管理器**（arch §3）：token 估算、状态快照块（任务板一行一任务）、附件摘录+`read_attachment` 分块、历史窗口+滚动摘要压缩。
  DoD：vitest：超预算触发压缩且未决事项保留（压缩 eval fixture）；快照块随 store 变化。
  ✅ 2026-07-04 验证方式：`src/agents/harness/context.ts` 实现状态快照块（任务一行一条，不含完整 JSON，测试验证随 tasksStore 增删改实时变化）、附件摘录（首 1k 字+附件名，超长提示走 read_attachment）、`CalibratedEstimator`（chars/1.6 启发式 + usage 校准滑动平均）、`needsCompression`/`compressHistory`（会话历史 8k 预算、超预算时把最老一段交给注入的 summarize 函数、保留最近≥6 轮原文不动、压缩 eval fixture 验证"未决事项"信息经摘要保留且压缩后不再超预算）；`src/agents/tools/content.ts` 落地 `read_attachment`（按 2000 字分块翻页，含附件文本拼接，chunk 越界报错），10+7 共 17 个用例全绿；`pnpm test`（21 文件 138 用例）/`pnpm compile`/`pnpm build` 全绿。get_prompt_template/draft_user_prompt/draft_message 留给 T10 补齐同一个 content.ts。
- [x] **T08 提示词装配器**（arch §4）：六块模板（identity/tool-policy/state/contract/style/memory）+ 四个 profile 的块组合与参数；快照测试锁定；`#/trace` dev 页（run 列表+逐轮展开）。
  DoD：`pnpm test` 快照绿；mock 下手动跑一次 decomposer run，在 `#/trace` 能看到完整装配与逐轮记录。
  ✅ 2026-07-04 验证方式：`src/agents/prompts/blocks/*`（identity/tool-policy/state/contract/style/memory，六块均首行注释写"为什么存在"）+ `assemble.ts` 按顺序拼接、空块自动跳过，11 个快照/行为用例；`src/agents/profiles/{decomposer,organizer,reporter,orchestrator}.ts` 组装四个 profile（含 decomposer/organizer 的 zod 输出契约、fallback 降级、工具白名单、按 spec 差异化 temperature），13 个用例+4 份系统提示词快照；新增 `src/agents/registry.ts`（汇总当前已落地工具）与 `src/store/traceStore.ts`（AgentRun 环形缓冲最近 100 条，持久化+roundtrip 测试）；`src/mocks/llm/fixtures.ts` 补发布会四任务剧本 fixture（与原型 seedTasks/newTasks 对齐），验证拼出内容通过 `DecomposerOutputSchema`；`entrypoints/trace`（unlisted-page）实现 `#/trace` dev 页——run 列表+点击展开逐轮详情（assistantText/toolCalls/usage/durationMs/finalOutput），带「跑一次 decomposer（mock）」按钮；`pnpm build` 后用 Playwright 加载真实解包扩展点击该按钮，截图确认 run 出现、outcome=contract、4 个任务的 finalOutput 完整展示，控制台无报错；`pnpm test`（25 文件 169 用例）/`pnpm compile`/`pnpm build` 全绿。**M1 里程碑完成**：mock 下多轮工具调用 + trace 全链路可跑可查。

### M2 接上 AI

- [x] **T09 设置向导**：3 步 UI 照原型；预设与注册链接（spec §3.4）；`/models` 探测回退；推理模型识别置顶+自动选中+非推理警告；测试连接三态（成功/401/429）。
  DoD：mock 下 Playwright 走完全流程；错误态文案与"回设置"引导齐全。
  ✅ 2026-07-04 验证方式：`src/llm/presets.ts`（5 预设表）+ `reasoningModel.ts`（spec 正则+白名单覆盖，17 用例）+ `models.ts`（`/v1/models` 探测回退+错误分类，本地 http server 测 5 态）+ `mockModels.ts`（按预设关键词模拟推理/非推理混合模型列表）；`transport.ts` 加 `maxTokens`→`max_tokens`；`testConnection.ts`（1-token 测试连接，成功/401/429/network 四态 DI 测试）；`src/components/settings/SettingsSheet.tsx` 照原型 `.set-sheet` 实现 3 步向导（复用 Sheet/Chip/Field/Button），直接绑定 settingsStore（无独立草稿态）；新增 `clearAllData()`（设置页双确认清空全部 store，测试覆盖）；接入 sidepanel 头部齿轮按钮（`uiStore.settingsOpen`）；`VITE_PAIHUO_MOCK=1` 构建后 Playwright 加载真实解包扩展，走完选平台→粘 key→拉取模型列表→推理模型自动置顶选中→手动切非推理模型触发红条警告→切回→测试连接成功显示"已连通 · deepseek-reasoner · 22ms"，全程截图存 `docs/qa/T09-*.png`，控制台无报错；`pnpm test`（30 文件 201 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock 两种构建）全绿。

### M3 核心循环：倒活→拆解→派活

- [x] **T10 内容与知识工具**：`read_attachment`（txt/md/pdf/docx/csv/xlsx 解析→分块）、附件白名单校验 UI、`get_prompt_template`、`draft_user_prompt`、`draft_message`。
  DoD：解析器 fixture 单测；传 `.exe` 被拒 toast；分块读取单测。
  ✅ 2026-07-04 验证方式：安装 pdfjs-dist/mammoth/xlsx，`src/content/parseAttachment.ts` 解析 txt/md/pdf/docx/csv/xlsx，测试用真实构造的最小 pdf（手写）/docx（jszip 现场打包）/xlsx（SheetJS 现场写出）fixture 验证，不 mock；发现 mammoth 实际不支持旧版二进制 .doc（只支持 OOXML .docx），已在解析失败时走友好报错路径；`src/content/attachmentWhitelist.ts` 白名单校验；`src/components/attachments/AttachButton.tsx` 拒收非白名单文件弹原型文案 toast，命中的解析后存入 fragmentsStore（RTL 组件测试 3 例）；`/components` dev 页临时演示区 + Playwright 用真实 .exe/.txt 文件走一遍拒收/解析全流程，截图 `docs/qa/T10-*.png`；`src/agents/tools/content.ts` 扩展 `get_prompt_template`（任务类型四段骨架+已知工具名插入角色段，未知 toolId 优雅降级）、`draft_user_prompt`（按任务生成外部提示词，slots 覆盖对应段落其余保留【】空槽）、`draft_message`（催办/教做法 3 步/直接可发三种小抄）；`src/agents/prompts/external/taskTypeTemplates.ts` 五个任务类型模板骨架；注册进默认工具表，orchestrator 白名单补上 draft_user_prompt/draft_message；`pnpm test`（33 文件 241 用例）/`pnpm compile`/`pnpm build` 全绿。遗留优化项：pdfjs/mammoth/xlsx 体积大（dev 页 chunk 1.3MB），按 dev-plan 风险备忘留给 T21 打磨时做动态 import 代码分割。
- [x] **T11 拆解官链路**：decomposer profile（契约=spec §6.1 schema）接倒活 UI：思考态流光两段文案（来自 loop 流式事件）→ 骨架 → 任务卡逐张入场；空槽【…】高亮渲染。
  DoD：mock 下点「拆解」产出与原型一致的 4 卡；契约校验失败走降级卡路径（单测）。
  ✅ 2026-07-04 验证方式：`materializeDecomposerOutput.ts` 把拆解官输出（localId 互相引用）落成真实 task/group/relation 记录（3 用例，含关联引用不存在 id 时跳过不抛错）；`runDecompose.ts` 核心逻辑用脚本化 mock LLM 测试契约一次通过/两次失败走 fallback「待手动拆」降级卡/401 报错三态（4 用例，覆盖 DoD 的单测要求）；`useDecomposeRun` 钩子包一层 React 状态，思考态两段文案由 `onDelta` 真实流式事件驱动切换（不是定时器假装）；`TaskCard` 组件（空槽【】高亮渲染成 `<mark>`、展开/收起、复选框标记完成，6 个 RTL 用例）；`AttachButton` 扩展 `onFile` 回调支持倒活面板攒附件后一次性提交（不再各自建 fragment）；`DumpPanel` 整合 textarea+附件+试试示例+拆解按钮+思考态+骨架屏+卡片逐张入场动效，接入 sidepanel 活儿 tab（原 ToastProvider 上移到 App 根节点）；`VITE_PAIHUO_MOCK=1` 构建后 Playwright 加载真实解包扩展，点「试试示例」→「拆解」，产出与原型一致的 4 张任务卡（含 due/fit/type/工具名徽标）、展开后【粘贴飞书妙记的转写文字】高亮正确、倒活框正确折叠成"再倒点活儿进来"细条，控制台无报错，截图存 `docs/qa/T11-*.png`；`pnpm test`（36 文件 255 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。
- [x] **T12 工具目录与卡片动作**：`assets/tools.json`（spec §5）+ `pnpm check:tools` URL 核验脚本；「复制提示词 · 打开工具」（clipboard+tabs）、「复制小抄」、「标记完成」动效。
  DoD：check:tools 全绿；Playwright 断言复制内容与开 tab（mock tabs）。
  ✅ 2026-07-04 验证方式：`src/assets/tools.json` 补齐 spec §5 完整 16 项目录（categories/strengths/priceNote/registerNote）；`scripts/check-tools.mjs`（`pnpm check:tools`）真实请求逐一核验，2xx/3xx 通过、403/429（Cloudflare 反爬挑战等）降级为警告不算失败、真失效才报错退出非零；发现沙箱网络走本地代理导致 Node fetch 不像 curl 自动读 HTTP_PROXY，已用 `undici` 的 `ProxyAgent` 接上，16/16 全部核验通过（2 个是确认过的真实站点，被反爬拦截打警告）；`TaskCard` 补上「复制提示词 · 打开工具」真实动作（`navigator.clipboard.writeText` + `browser.tabs.create`，`vi.spyOn` mock tabs 断言调用参数）、复制成功态 2.6s 后自动还原、fit=self 只复制不开 tab、标记完成时插入粒子动效 span（9 个 RTL 用例覆盖，含 mock tabs 断言复制内容与开 tab 参数）；`pnpm build` 后 Playwright 加载真实解包扩展点「复制提示词·打开豆包」，验证剪贴板真实写入提示词全文、真开了一个指向 doubao.com 的新 tab（确认后立即关闭不等它加载完）、按钮切换已复制态+toast，再点「标记完成」截图确认动效与终态，控制台无报错；截图存 `docs/qa/T12-*.png`；`pnpm test`（36 文件 258 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。
- [x] **T13 整理官与筛选**：organizer profile（事件触发，见 T17 前先手动触发）产关联建议→横幅；类型筛选 chips+计数；分组头三态。
  DoD：mock 下筛「演示」只剩 PPT 卡；关联横幅出现/可关/进对话。
  ✅ 2026-07-04 验证方式：mock fixture 机制扩展 `respond` 动态响应（能从状态快照文本里抠出真实 task id 拼建议），新增 organizer fixture（2 用例覆盖命中/不命中）；`runOrganize.ts` 手动触发整理官（真实 taskId，不需要像拆解官那样做 localId 映射），4 个用例覆盖建议落库/无关联/契约降级/LLM报错四态；`groupTasks.ts` 纯函数把任务分桶成 紧急(due.hot)/项目(有groupId)/日常 三态、项目组算出组内关联数（6 用例）；`GroupHeader`/`TypeFilterRow`/`RelationBanner` 三个展示组件（8 个 RTL 用例）；接入 `DumpPanel`：类型筛选行+计数、按分组渲染、关联横幅（仅在筛选=全部时显示，命中原型行为）、横幅"分开做"本地隐藏不删数据、"好，先定关键信息"调 `openChat()`+toast（真正的对话 UI 是 T14 的事，这里先做状态级前向兼容）、活儿 tab 头部新增手动"找关联"图标按钮触发 organizer。Playwright 用真实解包扩展验证：拆解出的 4 卡正确分成"今天必须交"（红）/"下周一·新品发布会"（蓝+2件有关联）/"日常"（灰）三组、筛"演示"只剩 PPT 卡且横幅收起、切回全部横幅重新出现、点"分开做"横幅消失，控制台无报错，截图存 `docs/qa/T13-*.png`；`pnpm test`（41 文件 278 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。**M3 里程碑完成**：核心价值（倒活→拆解→派活）可完整演示。

### M4 盯活：小派 orchestrator

- [x] **T14 主对话 agent**：orchestrator profile 接对话 UI（dock+抽屉+流式+建议 chips+附件消息）；`dispatch` 委派（深度≤1）；ui 工具（reveal_card/notify/open_tool_site 含用户手势门）；**活动指示**（状态短句实时来自工具调用，arch §6）。
  DoD：mock 剧本：「会议纪要发完了」→ complete_task 划卡+进度环；「PPT 怎么开始」→ 3 步教学+跳卡高亮；乱输入→友好兜底。trace 里能回放该 run。
  ✅ 2026-07-04 验证方式：`loop.ts` 扩展 `history`（续接多轮对话消息数组）与 `onToolCall`（活动指示回调，工具执行前上抛这批调用）两个可选项，2 个新用例；mock fixture 机制升级支持多轮剧本——`LlmFixture.steps` 数组，`mockTransport` 按"已经产生的 tool 结果数"选对应 step（不依赖轮次里无关的历史消息数），新增 `orchestrator-meeting-done`（先 complete_task 再文本结论）/`orchestrator-ppt-howto`（先 reveal_card 再三步教学）两个真实剧本 fixture，从 system 提示词里的状态快照抠真实 task id；`src/agents/tools/ui.ts` 落地 `reveal_card`/`notify`/`open_tool_site`（均 effect=ui），uiStore 加 `reveal`/`notification`（nonce 版本号保证同目标可重复触发）；`src/agents/tools/dispatch.ts` 的 `dispatch` 委派 decomposer/organizer/reporter，深度天然 ≤1（子 profile 白名单都没有 dispatch）；`registry.ts` 支持可选 `dispatchDeps` 才注册 dispatch；orchestrator 白名单补齐 reveal_card/notify/open_tool_site/dispatch；`runChat.ts` 封装聊天场景的 run（allowUiExternal 恒真、outcome==='text' 才算成功，其余走友好错误文案）；`useOrchestratorChat` 钩子管多轮历史续接+流式拼接+活动短句（`activityLabels.ts` 工具名→口语短句映射）+ 落 trace；`ChatDock`/`ChatSheet` 组件照原型视觉（呼吸圆点+消息气泡+打字指示器+附件），`App.tsx` 的 `activeTab` 改用 uiStore（本地 state 无法被 reveal_card 从组件树外部驱动，这是必须修的真实 bug）；`TaskCard` 接 uiStore.reveal 做展开+滚动进视野+临时高亮（1.8s 自动消退）；`NotifyBridge` 桥接 notify 工具到 Toast。Playwright 用真实解包扩展全流程验证：「试试示例」拆解出 4 卡后，点 dock 快捷 chip「会议纪要发完了」→ 对话里 complete_task 执行+文本确认+关闭对话后卡片确实划线；点「PPT 不知道从哪下手」→ reveal_card 立即把 tab 切到「活儿」+目标卡自动展开，随后三步教学文本到达；乱输入「哈哈哈随便打点字测试一下」→ 命中 DEFAULT_FIXTURE 友好兜底；`#/trace` 页确认 3 条 orchestrator run（2 轮/2 轮/1 轮，均 outcome=text）；全程控制台无报错，截图存 `docs/qa/T14-*.png`；`pnpm test`（48 文件 320 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。
- [x] **T15 长期记忆**：`remember/recall` 工具 + 用户画像块（800 字上限+淘汰）+ 工作日志（每日摘要，90 天滚动）+ 会话次日归档。
  DoD：单测：记忆写入→下次 run 的 system 记忆块可见；日志生成正确。
  ✅ 2026-07-04 验证方式：`src/store/memoryStore.ts`——用户画像 persist store，`facts: {text, lastUsedAt}[]`，超 800 字按 lastUsedAt 最小（最久没被 remember/recall 碰过）反复淘汰直到回到上限内（至少留一条），recall 命中的事实顺带刷新 lastUsedAt（"最近使用"减缓淘汰），7 个用例覆盖含 fake timer 精确验证淘汰顺序；`src/agents/tools/memory.ts` 落地 `remember`（effect=write）/`recall`（effect=read，自动 run 不许调 remember 但能读），5 个用例；`src/store/worklogStore.ts`——纯函数 `buildDailySummary(tasks, date)` 从 `doneAt`+`saveMin` 算出"完成 N 件活儿，预计省时 M 分钟：标题…"，`recordDay` 写入/覆盖指定日期（同一天不重复），`archiveIfNewDay(currentDate, tasks)` 是"会话次日归档"的机制核心——换了新的一天就把上一个活跃日的任务完成情况算成一条摘要落进工作日志（不需要额外持久化聊天正文，因为聊天记录本来就只在内存里，日志内容直接从已持久化的 tasksStore 推导，"正文丢弃"天然成立），滚动裁掉超过 90 天的旧条目，11 个用例；四个 profile（decomposer/organizer/reporter/orchestrator）的 `memory` 块都改喂 `useMemoryStore.getState().profileText()`，新增用例证明 remember 一条事实后四个 profile 组装出的 systemPrompt 都能看到（DoD 原文断言），无记忆时记忆块不出现（assemble 自动跳过空块，快照不受影响）；orchestrator 工具白名单补上 remember/recall；`registry.ts` 默认注册 memoryTools；`App.tsx` 挂载时调用 `archiveIfNewDay` 完成真实接线；`clearAllData`/`store/index.ts` 收尾。Playwright 冒烟：真实解包扩展加载+刷新（模拟次日重开）控制台无报错。`pnpm test`（51 文件 345 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。
- [x] **T16 总览页**：spec §3.1 全区块动态化 + 空态 + 跳转。
  DoD：拆解前后数字/类型/到期全随 store 变化，Playwright 断言。
  ✅ 2026-07-04 验证方式：抽出 `src/components/tasks/taskTypeMeta.ts`（TYPE_LABELS/TYPE_ORDER 共享，消除 TaskCard/TypeFilterRow 里各一份的重复定义）；新增 `src/components/overview/OverviewPanel.tsx`——问候（按小时段+可选 settings.userName）+ 复用现成的 `ProgressRing`（done/total）+ 统计行（今天 N 件·完成 M·未完成任务省时汇总，60 分钟内说分钟/以上换算小时，对应原型 fmtSave）；空态引导条（`total===0` 时显示，点击跳活儿 tab）；按类型看（只列出现过的类型+计数，点击=筛选+跳活儿 tab）；盯紧截止时间（未完成且有 due 的任务，hot 排前面，点击=跳活儿 tab+`revealTask` 高亮，空态"没有压着的截止时间，舒坦。"）；今天的成果（已完成数+省时汇总，空态"还没划掉活儿"）；CTA "把今天写成日报"跳汇报 tab。踩了一个 zustand 选择器坑：`useTasksStore(s => Object.values(s.tasks))` 每次渲染返回新数组引用触发无限重渲染（"Maximum update depth exceeded"），改成选原始 `tasks` 对象+`useMemo` 派生数组解决。10 个 RTL 用例覆盖空态/有数据两种场景的全部区块与跳转行为；接入 `App.tsx` 替换总览占位。Playwright 用真实解包扩展验证：拆解前空态引导条+点击跳活儿 tab；「试试示例」拆解出 4 卡后总览进度环 0/4、按类型看 3 类计数正确、盯紧截止时间显示"会议纪要"那条（唯一带 due 的）、点击跳活儿 tab 并高亮；点类型 chip 跳活儿 tab 且筛选生效；标记一件非截止任务完成后进度环变 1/4、今天的成果实时反映、截止列表不受影响；点 CTA 跳汇报 tab；全程控制台无报错，截图存 `docs/qa/T16-*.png`；`pnpm test`（52 文件 355 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）全绿。
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
