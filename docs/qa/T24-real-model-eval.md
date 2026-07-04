# T24 真 key 冒烟 + 真模型评测

用户提供真实 DeepSeek API key 本地测试（未提交到仓库，只存在会话临时目录，测试结束已销毁）。
新增 `evals/real-model.manual.test.ts` + `vitest.eval.real.config.ts` + `pnpm eval:real`：
复用 `evals/fixtures/decomposerGoldens.ts` 的原话输入，换真实 DeepSeek API 跑一遍拆解官/整理官/
小派/汇报官全部四个 profile，人工读输出跟人工标注比对。不设 `PAIHUO_REAL_API_KEY` 时全部用例
自动跳过，不影响 `pnpm test`/`pnpm eval`/CI。

## 发现并修复的真实 bug（mock 全绿但真模型一跑就暴露）

### 1（严重）`search_tool_catalog` 对真实查询永远返回空数组

**现象**：第一轮真模型冒烟里，拆解官对全部 6 个金标准场景几乎清一色把 `fit` 判成 `self`
（AI 完全帮不上）、`toolId` 全部留空——直接废掉了"AI 能帮多少、该用哪个工具"这条产品核心
价值主张。

**根因**：`src/agents/tools/catalog.ts` 的 `matchScore` 用整句去匹配 `name`/`strengths`
这种短字段（`entry.name.includes(query)`）。单测里用的是 `query: 'PPT'` 这种单个关键词，
凑巧能命中，所以一直是绿的。但真模型发的是自然语言短句（如 `"PPT 渠道政策 经销商 发布会"`），
整句去匹配几十字的短字段几乎不可能命中——加日志实测：真实调用的 `search_tool_catalog`
返回 `result: []` 是常态，工具本身"能力健全"但从没真正返回过东西。

**修复**：[`src/agents/tools/catalog.ts`](../../src/agents/tools/catalog.ts) 把 `matchScore`
改成按空格/逗号/顿号切词，任一词命中就计分，不再要求整句是子串。新增 2 个单测覆盖真实
多词查询场景（[`catalog.test.ts`](../../src/agents/tools/catalog.test.ts)）。

**修复前后对比**（同一个"发布会四事项"输入，deepseek-reasoner）：

| | 修复前 | 修复后 |
|---|---|---|
| PPT 任务 | fit=self，无 toolId | fit=assist，toolId=gamma，含 PPT 大纲提示词 |
| 会议纪要任务 | fit=self，无 toolId | fit=full，toolId=doubao |
| 宣传文案任务 | fit=self，无 toolId | fit=full，toolId=deepseek |
| 销售数据任务 | fit=self，无 toolId | fit=assist，toolId=tongyi |

### 2（严重）附件摘录没告诉模型 `read_attachment` 该传什么 id

**现象**：带附件的场景里，模型反复调 `read_attachment({fragmentId: "附件.txt"})`（拿附件的
**文件名**当 id），六轮全部"片段不存在"，最后 `bailout`——拆解一个结果都交不出来。

**根因**：[`src/agents/harness/context.ts`](../../src/agents/harness/context.ts) 的
`excerptFragment` 只把附件**名字**塞进提示词（"附件：附件.txt"），从没提过
`read_attachment` 真正认的 `fragmentId` 参数应该填这个 fragment 自己的 id
（`content.ts` 的 `fullTextOf(fragmentId)` 是从 `useFragmentsStore` 里按 id 查的，
跟文件名无关）。模型没有这个信息，只能瞎猜文件名。

**修复**：`excerptFragment` 在原文被截断或有附件时，都显式把 `fragment.id` 写进提示词
（如 `read_attachment(fragmentId="真实id")`），三种情况（截断+有附件/仅截断/仅有附件）
分别给出对应文案。新增 2 个单测（[`context.test.ts`](../../src/agents/harness/context.test.ts)）。
修复后模型第一次调用就传对了 id，成功读到附件全文并给出合理拆解。

（调试过程中还发现测试脚本自身的一个坑：手搓 `Fragment` 对象直接传给 `runDecompose`，不经
`useFragmentsStore.addFragment` 落库，会导致哪怕模型猜对/被正确告知了 id，`read_attachment`
也查无此片段——因为真实 `DumpPanel` 流程是先 `addFragment` 再传给 `runDecompose` 的。
`real-model.manual.test.ts` 已同步改成一致的调用顺序。）

### 3（中等）汇报官在报告正文前加寒暄/数据罗列

**现象**：日报/周报/月报三种输出，真模型经常在 `# 日报` 这类标题前先来一句
"好的，已查询到本月任务数据，没有模板，按默认结构来写"，deepseek-chat（无独立推理通道
的模型）甚至会在正式内容前先罗列一段"根据任务板数据：- t1 标记为 done…"的草稿式笔记——
这些内容会被原样复制/下载发给领导，用户还得手动删掉开头这几行。

**修复**：[`src/agents/profiles/reporter.ts`](../../src/agents/profiles/reporter.ts) 的
风格块加一条明确规则："终局文本就是要发给领导的报告全文，不是聊天回复……第一个字符就是
报告标题"。用 deepseek-reasoner 复测 3/3 报告全部从标题直接开始，无寒暄无客套结尾。
deepseek-chat（推荐模型之外的备选项）上仍偶尔残留类似模式——reasoner 有独立的
`reasoning_content` 字段承接"内心戏"，chat 系列没有这个分离通道，思考过程更容易泄漏进
可见输出；由于 deepseek-reasoner 是默认推荐模型且已验证干净，这一点记为已知的模型差异，
不继续为 chat 系列单独加宽松判断逻辑。

## 验证覆盖

用 `deepseek-reasoner`（DeepSeek 平台默认推荐的推理模型）完整跑了一遍：

- **拆解官**：6 个金标准场景（发布会四件套/带附件/带闲聊干扰/超长转写/策略保守性/多截止日期）
  全部产出合理的 `title`/`type`/`fit`/`toolId`/`prompt`（含【】空槽），5/6 一次通过契约校验，
  1 次触发 `contract_fallback`（正常的既有安全网，不是新 bug——同一场景重跑即恢复正常，
  真模型偶发输出格式不稳属预期内的正常波动，两次重试仍不过才会走降级卡）。
- **整理官**：正确识别出「发布会 PPT」与「宣传文案」的关联，给出合理的 reason/suggestion。
- **小派 orchestrator**：三个剧本——「会议纪要发完了」正确调 `complete_task`；「PPT 不知道
  从哪下手」给出务实的分步指导（有时先问清关键信息而非机械照搬三步模板，判断合理）；
  乱打字友好兜底且不误触发工具。
- **汇报官**：日/周/月三种报告结构清晰、口径量化、结论先行，符合"给领导看"的语气要求。

`deepseek-chat`（非推荐的备选模型）做了抽样对照：拆解质量与 deepseek-reasoner 相当甚至
略快（无需承担推理token的时间/费用开销），但汇报官偶发前置寒暄/数据罗列，已如上记录。

## 结论：本轮不改动任何契约（zod schema/工具签名/agent 输出结构），只修了两个真实代码 bug
（`search_tool_catalog` 匹配算法、`excerptFragment` 缺失的 fragmentId 提示）和一处提示词
措辞（汇报官禁止寒暄），完全符合"迭代提示词/实现，契约不变"的 DoD 要求。

`pnpm test`（58 文件 407 用例）/`pnpm compile`/`pnpm build`（mock 与非 mock）/`pnpm eval`
（31 用例）/`pnpm e2e` 全绿。`pnpm eval:real` 需要设置 `PAIHUO_REAL_API_KEY` 环境变量才会
真正执行（未设置时全部跳过，不影响任何自动化流程）。
