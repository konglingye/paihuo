# T21 打磨检查清单

发布前的收尾体验检查，覆盖 spec/architecture 之外的"最后一公里"细节。全部项目均在
`VITE_PAIHUO_MOCK=1 pnpm build` 产出的真实解包扩展上用 Playwright 或手动验证，非纯单测宣称。

## 1. 空态 / 错误态 / 429 引导

逐个面板检查首次打开（无数据）和 LLM 报错两种情况下用户是否拿到可行动的提示，而不是空白或误导文案。

| 位置 | 检查内容 | 结果 |
| --- | --- | --- |
| 总览页 | 无任务时显示「活儿还没倒进来——去「活儿」页倒一段试试」，可点击跳转 | 已有，符合 |
| 活儿页 | 无任务/筛选后无匹配时分别显示对应空态文案 | 已有，符合 |
| 汇报页 | 无历史记录时显示空态引导 | 已有，符合（`T18-report-empty.png`） |
| 对话抽屉 | **发现缺口**：从未有过消息时抽屉是纯空白，没有任何引导 | **已修复**，见下 |
| 找关联报错 | **发现真 bug**：`runOrganize` 把 LLM 真报错（网络/超时/401/429）和"模型正常返回零建议"混为一谈，统一显示「没找到明显的关联」，用户会把 key 失效误判成"这批活儿真的没关联" | **已修复**，见下 |
| 设置向导 429 | `SettingsSheet.describeError` 里的 429 文案跟其余三处（decompose/organize/chat/report）不一致，多了个「稍」字 | **已修复**，见下 |

### 修复 1：`runOrganize` 报错状态外泄

- [`src/agents/runOrganize.ts`](../../src/agents/runOrganize.ts)：`RunOrganizeResult` 新增 `error?: string`
  字段，只有 `agentRun.error` 真的存在（网络/超时/401/429/未知）时才填充，契约降级或模型正常给出空建议
  都不设该字段。新增 `describeOrganizeError`，四种已知错误类型给出与其余 run* 文件一致的友好文案。
- [`src/components/dump/DumpPanel.tsx`](../../src/components/dump/DumpPanel.tsx)：`handleFindRelations`
  优先展示 `result.error`（如有），否则才走"找到 N 组 / 没找到明显的关联"的原逻辑。
- 测试：[`src/agents/runOrganize.test.ts`](../../src/agents/runOrganize.test.ts) 新增网络错误、429
  两种真报错场景断言具体文案，以及"模型正常返回空建议时不应该带 error"的反向断言，6/6 通过。
- 顺带修了测试用的 `scriptedDriver` mock 驱动没有夹住脚本下标的问题——`rate_limited`/`network`
  这两类错误会被 `callLlmWithRetry` 自动重试一次，脚本只写一条时第二次调用原先会读到
  `undefined` 导致抛出无关的 `TypeError`，掩盖了真实断言。

### 修复 2：429 文案统一

- [`src/components/settings/SettingsSheet.tsx:17`](../../src/components/settings/SettingsSheet.tsx)：
  「请求太频繁了，稍等几秒再试」→「请求太频繁了，等几秒再试」，与 `runDecompose`/`runOrganize`/
  `runChat`/`runReport` 四处的 `describeXError` 措辞完全一致。

### 修复 3：对话抽屉首次打开空态

- [`src/components/chat/ChatSheet.tsx`](../../src/components/chat/ChatSheet.tsx)：`visibleMessages`
  为空且不在打字状态时，居中显示一条引导「跟小派说点什么，聊聊进度或者接下来怎么派」+ 淡色对话
  图标，语气与总览页空态一致，原型本身没有这个状态（原型的对话抽屉永远预置了演示对话），因此这里
  是新增而不是照抄。
- 可达路径：关联横幅点「好，先定关键信息」只调 `openChat()`，不发消息——如果这是用户第一次打开
  对话，抽屉此时确实是零消息状态。
- 测试：[`src/components/chat/ChatSheet.test.tsx`](../../src/components/chat/ChatSheet.test.tsx) 新增
  2 个用例（空消息显示引导 / 有消息后不显示），RTL 真实渲染断言，7/7 通过。
- Playwright 全链路验证：真实解包扩展里「试试示例」拆解出 4 卡 → 点「手动找一次关联」出横幅 →
  点「好，先定关键信息」→ 抽屉展开且显示空态引导文案，截图 [`T21-chat-empty-state.png`](./T21-chat-empty-state.png)。

## 2. reduced-motion 全局支持

- [`src/styles/tokens.css`](../../src/styles/tokens.css) 末尾加了
  `@media (prefers-reduced-motion: reduce)`，把所有 `animation`/`transition`（含内联 style）压到
  近乎瞬时（0.01ms）且只播一遍，`scroll-behavior` 也收成 `auto`。
- 排查过程中定位到两个 Tailwind v4 构建管线的坑：
  1. 自定义 `@keyframes ping`（呼吸圆点的 box-shadow 脉冲）撞上 Tailwind 内置 `animate-ping`
     工具类同名的 `@keyframes ping`，构建产物里被 Tailwind 自己的定义悄悄覆盖——改名
     `orb-ping` 解决。
  2. 紧邻 `@media (prefers-reduced-motion: reduce)` 规则前的**多行** CSS 注释会导致整条规则被
     构建产物完整丢弃（多次 clean rebuild 复现，逐属性/逐写法排除后确认是"多行注释+规则在文件
     末尾"这个组合触发），换成单行注释即可正常出现在产物里。已在源码里用单行注释记录这个坑。
- Playwright A/B 验证：`page.emulateMedia({ reducedMotion: 'reduce' })` 前后对比 `.orb::after`
  的动画时长，正常态 2.8s vs 减弱态 0.00001s，生效确认。

## 3. 360–420px 响应式实测

- 分别在 360px 和 420px 视口下截图总览/活儿/汇报/对话/设置五个面板，共 10 张截图
  （`T21-responsive-{360,420}-{overview,jobs,report,chat,settings}.png`），逐张检查文字换行、
  按钮可点区域、横向溢出情况，均无需修复。

## 4. 文案对照原型校对

系统性比对 `prototype/paihuo-prototype.html` 与实现代码里的用户可见文案，重点检查空态/按钮/提示
语气是否与原型一致。审查发现两处疑似差异，逐一核实后均判定为**不应修改**：

- 原型的「剧本 ①/②/③」按钮是原型自带的演示/联调脚手架，用来手动切换固定的假数据场景，产品里
  没有对应概念（真实产品靠拆解官/整理官实时产出，不需要手动切场景）——不是文案缺口。
- 原型「拆出了 4 件事」这类措辞硬编码了具体数字，真实产品里任务数量随输入内容变化，不能照抄
  固定数字，现有实现用的是动态计数文案，是正确做法而非遗漏。

结论：现有文案已经与原型在语气和结构上对齐，此项无需改动。

## 5. 全绿验证

- `pnpm test`：58 个测试文件，404 用例全部通过。
- `pnpm compile`（`tsc --noEmit`）：无类型错误。
- `VITE_PAIHUO_MOCK=1 pnpm build` 与 `pnpm build`（非 mock）均构建成功。
