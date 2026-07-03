# 派活儿 · 智能体架构（Agent Harness）v1.0

> 定位：**扩展内常驻的完整智能体**，不是"每个按钮各调一次大模型"。所有 LLM 能力必须经由本文的 harness 运行——统一循环、统一工具、统一上下文、统一观测。UI 组件里**禁止**裸调 chat completions。

## 0. 总览

```
┌─ UI（面板/对话/事件）─────────────────────────────┐
│            ▼ 发起 AgentRun(profile, input)         │
│  ┌─ Harness 运行时 ─────────────────────────────┐  │
│  │ PromptAssembler → ContextManager → AgentLoop │  │
│  │        ▲                │    ▲                │  │
│  │   prompts/ 分块模板      │    │ ToolExecutor   │  │
│  │   memory/ 长期记忆   LLM Transport  ToolRegistry│ │
│  │        └────── Trace（AgentRun 全程记录）──────┘ │
│  └───────────────────────────────────────────────┘  │
│  EventBus：dump.created / task.completed / alarm …  │
└─────────────────────────────────────────────────────┘
```

四个 **Agent Profile** 共享同一个 harness：`orchestrator 小派`（主对话/调度）、`decomposer 拆解官`、`organizer 整理官`、`reporter 汇报官`。Profile = 数据（提示词块 + 工具白名单 + 参数 + 预算 + 输出契约），harness = 唯一的代码路径。

## 1. Agent Loop（`src/agents/harness/loop.ts`）

```ts
async function runAgent(profile, input, opts): Promise<AgentRun> {
  const ctx = ContextManager.build(profile, input);        // §3
  for (let turn = 0; turn < profile.maxTurns; turn++) {
    const msg = await llm.stream(ctx.messages, profile.tools, profile.params, opts.signal);
    trace.turn(msg);
    if (msg.toolCalls.length === 0) return finalize(msg);   // 文本终局
    const results = await ToolExecutor.run(msg.toolCalls);  // §2，只读工具并行
    ctx.append(msg, results);
    ctx.enforceBudget();                                    // 超预算触发压缩 §3.2
  }
  return finalize(bailout());  // 兜底：超轮次→请模型直接总结收尾
}
```

硬性要求：
- **流式**：文本增量与工具调用状态实时上抛给 UI（活动指示，见 §6）。
- **可中断**：AbortController 贯穿传输层与工具层；UI 有停止按钮。
- **预算护栏**：`maxTurns`（默认 6）、每轮最大工具调用数（默认 4）、单次 run 估算 token 上限（默认 32k，超限先压缩再拒绝）、连续两轮空转（无新信息）→ 强制收尾。
- **结构化输出**：带 `outputContract`（zod schema）的 profile，终局必须过校验；失败自动附错误重试 1 次，再失败按降级路径处理（如拆解失败→把原文塞一张"待手动拆"卡）。
- **错误分级**：401/403 → 终止并引导设置页；429 → 退避重试 1 次；网络/超时 → 重试 1 次；工具异常 → 变成 tool_result 里的结构化错误交回模型自行处理（不炸整个 run）。

## 2. 工具编排（`harness/tools.ts` + `tools/*.ts`）

**ToolRegistry**：每个工具 = `{name, description(中文，面向模型), paramsSchema(zod→JSON Schema), handler, effect, confirm?}`。`effect ∈ read | write | ui | external`；executor 按 effect 决定：read 可并行、write 串行、ui/external 需处在用户手势会话内或弹确认。全部调用带超时（默认 10s）与结构化错误返回。

工具清单（按域）：

| 域 | 工具 | effect |
|---|---|---|
| 任务库 | `list_tasks(filter)` `get_task(id)` `create_tasks(drafts[])` `update_task(id,patch)` `complete_task(id)` `group_tasks(ids,label)` `link_tasks(ids,reason)` | read/write |
| 知识 | `search_tool_catalog(query, taskType?)`（**封闭目录**内检索） `get_prompt_template(toolId, taskType)` | read |
| 内容 | `read_attachment(fragmentId, chunk?)`（分块读取长文档） `draft_user_prompt(taskId, slots)`（生成交付给用户的外部提示词） `draft_message(kind, context)`（小抄） | read |
| 记忆 | `remember(fact)` `recall(topic)`（§3.3 用户画像/偏好） | write/read |
| 汇报 | `query_task_history(range)` `read_template()` | read |
| UI | `reveal_card(taskId)` `notify(text)` `open_tool_site(toolId)`（复制+开标签，必须用户点击触发） | ui |
| 调度 | `dispatch(agent, input)`（orchestrator 委派子代理，同 harness 递归执行，深度≤1） | — |

每个 profile 拿**白名单子集**（如 reporter 拿不到 `open_tool_site`）。新工具必须带 vitest 用例（schema 校验 + handler + 错误路径）才算注册完成。

## 3. 上下文管理（`harness/context.ts` + `memory/`）

### 3.1 组装顺序（每次 LLM 调用重新装配）
```
[system] = 身份块 + 工具政策块 + 状态快照块 + 输出契约块 + 风格块 + 记忆块
[messages] = 滚动摘要块(若有) + 最近 N 轮原文 + 本轮输入(+附件摘录)
```
- **状态快照**：任务板压缩视图（每任务一行：id/标题/状态/due/fit），永不注入完整 JSON；细节靠 `get_task` 拉取——**检索优先于灌注**。
- **附件**：Fragment 只注入首 1k 字摘录 + 元信息，长文档由模型用 `read_attachment` 分块翻页。

### 3.2 窗口与压缩
- token 估算：中文按 `chars/1.6` 启发式 + 响应 `usage` 校准（各家模型无统一 tokenizer，写明是估算）。
- 会话历史超预算（默认 8k）→ **压缩**：把最老的一半轮次交给模型生成 200 字滚动摘要（含未决事项），替换原文；保留最近 6 轮原文。压缩本身记入 trace。

### 3.3 长期记忆（`chrome.storage.local`）
- **用户画像**：称呼/部门/工具偏好/纠正记录（"他说过纪要要发飞书不发微信"）——`remember/recall` 工具维护，注入 system 记忆块（上限 800 字，超出按最近使用淘汰）。
- **工作日志**：每天摘要一条（完成了什么、省时多少），供 reporter 写周报月报，滚动保留 90 天。
- 对话会话默认次日归档：正文丢弃，留摘要进工作日志。

## 4. 提示词编排（`agents/prompts/`）

两类提示词，都归 harness 管：
1. **内部提示词**（驱动 agent）：分块模板 = `identity / tool-policy / state / contract / style / memory` 六块，TS 模板函数 + 类型化槽位，按 profile 组合；**快照测试锁定**（改提示词必须过 review diff）；每块首行注释写"这块为什么存在"。
2. **外部提示词**（产品交付物，用户复制去别的 AI 工具）：由 `draft_user_prompt` 生成——目录里每个工具×任务类型有模板骨架（角色/任务/格式/语气四段），拆解官填充业务槽位，**用户必须补的信息一律写成【…】高亮空槽**。

Profile 参数随提示词一起版本化：`{model?, temperature, reasoningEffort?, maxTurns, tokenBudget}`——拆解官/小派走推理档，汇报官可低温快档；单 key 单平台，但结构上预留 per-profile 覆写。

## 5. 事件编排（`agents/events.ts`）

轻量事件总线 + 触发规则（规则=纯数据，可开关）：

| 事件 | 触发 |
|---|---|
| `dump.created` | 跑 decomposer；完成后自动跑 organizer（找关联） |
| `task.completed` | organizer 轻量检查（是否解锁关联任务→建议下一件） |
| `alarm.eod`（17:30，chrome.alarms） | 若当天有完成任务且未写日报 → 面板内温和提示（不推系统通知） |
| `settings.changed` | 失效模型探测缓存 |

背景执行在 MV3 service worker 中进行；所有自动 run 同样受预算与 trace 约束，且**自动 run 不许调 ui/external 工具**（只能产出建议，由用户点击兑现）。

## 6. 观测与可解释（`harness/trace.ts`）

- 每次 run 落一条 `AgentRun`：profile、输入摘要、逐轮消息/工具调用与耗时、token 估算、终局、错误。`chrome.storage` 环形保留最近 100 条。
- **活动指示（产品级要求）**：agent 工作时 UI 必须能看见它在干嘛——对话流光点 + 状态短句（"正在翻工具库…" "正在读你贴的转写…"），文案来自工具调用的中文描述，实时来自 loop 的流式事件。
- dev 模式挂 `#/trace` 检查页：run 列表 + 展开逐轮详情（开发与 e2e 断言都用它）。

## 7. 评测（`evals/`）

fixture 驱动、vitest 跑、mock 与真模型双通道：
- **拆解 evals**：≥6 段金标准"领导原话"（含带附件/带干扰闲聊/超长版）→ 断言：任务数、fit 保守性（不许把 assist 抬成 full）、每条提示词含≥1 个【】空槽、toolId 都在目录内、due 提取正确。
- **对话 evals**：脚本化多轮（"纪要发完了"/"PPT 怎么开始"/胡乱输入）→ 断言应调的工具序列与终局要素。
- **压缩 evals**：长会话压缩后，关键未决事项仍能被后续问答召回。
- 真模型档（T23 停点后）：同一套 fixture 换真 key 跑，输出人工过一遍并记分，作为提示词迭代依据。

## 8. 目录结构

```
src/agents/
  harness/ loop.ts context.ts tools.ts trace.ts budget.ts
  profiles/ orchestrator.ts decomposer.ts organizer.ts reporter.ts
  prompts/ blocks/ *.ts  外部模板 external/*.ts  __snapshots__/
  tools/ tasks.ts catalog.ts content.ts memory.ts report.ts ui.ts dispatch.ts
  memory/ profile.ts worklog.ts summarizer.ts
  events.ts
evals/ fixtures/ *.eval.test.ts
```

设计底线：harness 核心（loop/context/tools/trace）保持通用且小（目标 ≤900 行），一切业务差异放进 profile 数据与提示词块——这就是"完整智能体"和"一堆散调用"的区别。
