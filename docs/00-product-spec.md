# 派活儿 · 产品规格 v1.0（2026-07-04）

> UI 一切以 `prototype/paihuo-prototype.html` 为准（浏览器打开对照）。本文管功能语义、数据、提示词与边界。

## 1. 定位

**领导把活儿甩给你，你把活儿派给 AI。** 给不太会用 AI 的打工人：任务倒进来 → 自动拆成清单 → 每件事标注 AI 能帮多少、该用哪个工具、第一句话说什么 → 聊进度 → 一键写日报周报。

目标用户的三个"不会"：不知道**该用哪个** AI、不知道**该说什么**（提示词）、干活时**想不起来用**。产品是"翻译层 + 调度台"，**不是**替用户全自动干活的 agent（v0.1 不做自动执行）。

体验循环五动词：**倒活**（多形态输入）→ **派活**（拆解+分类+配工具+配提示词）→ **盯活**（对话改状态/教做法/找关联）→ **报活**（日报周报月报）→ 循环。

## 2. 形态与硬约束

- Chrome MV3 **sidePanel** 常驻侧边栏，action 点击 / 快捷键唤起；兼容 Chromium 系（Chrome/Edge 优先）。
- **无后端、无账号**：所有数据存 `chrome.storage.local`；LLM 调用从扩展直连用户配置的 OpenAI 兼容接口（host_permissions 动态授权解决 CORS）。
- **BYOK**：用户自己的 API key、自己的额度。产品的职责是把「注册→创建 key→复制→粘贴」引导到傻瓜级，**绝不**内置开发者的 key。
- 权限最小化：`sidePanel, storage, contextMenus, clipboardWrite, commands` + optional host permissions（按用户填的 base_url 动态申请）。
- 只做浅色主题、只做中文。

## 3. 信息架构（对照原型）

面板 = 头部（logo/日期/设置齿轮）+ 三个 tab + 底部对话 dock（汇报页隐藏 dock）+ 两个底部抽屉（对话 / 设置）+ toast。

### 3.1 总览 tab
问候（按时段）+ 完成进度环 `done/total` + 统计行（今天 N 件 · 完成 M · AI 预计帮你省 ≈X）；「按类型看」计数块（点击→活儿页对应筛选）；「盯紧截止时间」到期任务行（点击→跳卡并高亮）；「今天的成果」（完成数+省时，引导写日报）；CTA「把今天写成日报」；未倒活时显示引导条。

### 3.2 活儿 tab
- **倒活输入区**：textarea（placeholder 见原型）+ 附件按钮 + 语音按钮（v0.1 占位，见 §9）+「拆解」主按钮；支持粘贴/拖拽文件；拆解后收起为「+ 再倒点活儿进来」细条。
- **附件白名单**：`pdf txt md doc docx csv xls xlsx png jpg jpeg webp`，其余拒收并 toast（文案见原型）。文本抽取：txt/md 直读；pdf→pdfjs-dist；doc/docx→mammoth；csv/xlsx→SheetJS 转文本。图片：所选模型支持视觉则随消息发送，否则 toast 提示「换多模态模型或把内容打成字」。
- **类型筛选行**：全部/写作/演示/数据/沟通/杂事 + 计数，单选。
- **任务卡列表**：按分组渲染（紧急组红/项目组蓝带关联数/日常灰）；卡片=复选框+标题+徽标行（截止 pill、三档 fit pill、类型 tag、工具 chip）；展开=说明+「怎么让 AI 干」+提示词块（**空槽用高亮 mark，用户只填空**）+主按钮「复制提示词 · 打开 {工具}」（复制到剪贴板 + `chrome.tabs.create` 打开工具站）+「标记完成」。fit=self 的任务给「小抄」（可直接发的消息草稿）而非工具跳转。
- **关联横幅**：整理器发现可合并推进的任务时出现（见 §6.2）。

### 3.3 汇报 tab
日报/周报/月报分段 → 元信息条（基于 N 完成 M 进行中）→「上传公司模板（可选）」（白名单同上，解析为文本注入 prompt；已传显示绿色 chip 可移除）→「让 AI 写{日报}」→ 流式输出框 → 「复制全文」「下载 .md」。

### 3.4 设置抽屉「接上 AI，只需 3 步」
- **步骤 1 选平台**：预设 chips + 平台说明 tip + 「去注册 · 创建 API key」按钮（`chrome.tabs.create` 打开注册页）。
- **步骤 2 粘 key**：API key（password 输入）+ base_url（选平台自动填，自定义可改）。
- **步骤 3 连接选模型**：「连接并拉取模型列表」→ `GET {base_url}/v1/models`（兼容不带 /v1 的写法，做一次探测回退）→ 列表渲染，**推理模型置顶并自动选中**，非推理选中时红条警告 → 「测试连接」发一次 1-token chat 请求显示 `已连通 · {model} · {latency}ms`。
- 预设表（base_url / 注册页，执行时逐一核验可访问性）：

| 预设 | base_url | 注册/密钥页 |
|---|---|---|
| DeepSeek（推荐） | `https://api.deepseek.com` | `https://platform.deepseek.com` |
| Kimi 月之暗面 | `https://api.moonshot.cn/v1` | `https://platform.moonshot.cn` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `https://open.bigmodel.cn` |
| 豆包·火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | `https://console.volcengine.com/ark` |
| 自定义 | 用户填 | — |

- **推理模型识别规则**（用于置顶+徽标）：model id 匹配 `/reasoner|thinking|-r1|r1-|qwq|glm-z|o[134]-|gpt-5|seed.*think/i` → 推理；预设平台可用白名单精确覆盖。识别不了的标「未知」，不拦选择。
- 隐私文案：key 与任务只存本机浏览器，随时一键清空（设置底部给「清空所有数据」入口，双确认）。

### 3.5 对话（小派）
dock=快捷 chips + 输入条（含附件按钮+呼吸蓝点）；点开为底部抽屉：头部（小派 · 在线 · 手里记着 N 件活儿）+ 消息流（用户蓝底白字右侧 / 助手白卡左侧）+ 输入条。支持发文件（同白名单）。助手回复可带**建议 chips**（点击执行动作）。

## 4. 数据模型（TypeScript）

```ts
type TaskType = 'write'|'slide'|'data'|'comm'|'misc';
type Fit = 'full'|'assist'|'self';          // AI 可代劳 / 打下手 / 自己来·有小抄
type TaskStatus = 'todo'|'doing'|'done';

interface Task {
  id: string; title: string; note?: string;
  type: TaskType; fit: Fit; status: TaskStatus;
  toolId?: string;            // 指向工具目录；fit=self 时为空
  prompt?: string;            // 提示词或小抄，空槽写作【…】
  due?: { text: string; hot: boolean };     // 展示文本 + 是否紧急
  groupId?: string; saveMin: number;        // 预计省时（分钟）
  fragmentId: string; createdAt: number; doneAt?: number;
}
interface Fragment { id: string; raw: string; attachments: {name:string; text?:string}[]; createdAt: number; }
interface Group { id: string; label: string; kind: 'urgent'|'project'|'daily'; }
interface Settings {
  baseUrl: string; apiKey: string; model: string; presetId: string;
  userName?: string; org?: string;
}
interface ReportRecord { id: string; kind: 'daily'|'weekly'|'monthly'; content: string; createdAt: number; }
```

存储：zustand persist → `chrome.storage.local`，带 `schemaVersion` 与迁移函数。

## 5. 工具目录（closed catalog，杜绝幻觉链接）

`src/assets/tools.json`，路由器**只能**从中选择。Schema：`{id, name, url, registerNote, categories: TaskType[], strengths, priceNote}`。初始条目（URL 执行时逐一核验，失效就替换或删）：豆包 doubao.com、DeepSeek chat.deepseek.com、Kimi kimi.com、通义千问 tongyi.com、文心一言 yiyan.baidu.com、秘塔搜索 metaso.cn、通义听悟 tingwu.aliyun.com、飞书妙记 feishu.cn、WPS AI ai.wps.cn、讯飞星火 xinghuo.xfyun.cn、即梦 jimeng.jianying.com、可灵 klingai.com、剪映 jianying.com、Gamma gamma.app、DeepL deepl.com、沉浸式翻译 immersivetranslate.com。

## 6. 智能体层（机制 SSOT = `docs/02-agent-architecture.md`）

**所有 LLM 能力经统一 harness 运行**（agent loop + 工具编排 + 提示词装配 + 上下文管理 + trace + evals），UI 组件禁止裸调接口；传输层为 OpenAI 兼容 SSE（background 代发），mock 模式 `VITE_PAIHUO_MOCK=1` 读 `src/mocks/` fixtures（拆解 fixture 用原型的发布会四任务剧本）。本节只定义四个 **Agent Profile 的行为契约**（人设 + 输出 schema）——执行中可迭代提示词，契约不许变；工具白名单与机制细节见 arch §2。

### 6.1 拆解官 decomposer
输入：原话 + 附件（经 `read_attachment` 分块）+ 现有未完成任务快照。输出契约 JSON：`{tasks: Task草稿[], groups: Group[], relates: {aIds: string[], reason, suggestion}[]}`。
行为要点：把口语化指派拆成**可交付**任务（标题=动词开头的交付物）；fit 三档宁保守不吹牛（AI 只能起草的算 assist）；type 五选一；toolId 必须来自 `search_tool_catalog` 结果，选不出留空并降为 self；每条配外部提示词（`draft_user_prompt`）——**用户只填空**，必补信息写成【…】高亮空槽，含角色/任务/格式/语气四段；fit=self 给可直接发出的小抄；saveMin 保守估；due 提不出留空。
### 6.2 整理官 organizer
事件触发（dump.created 随拆解链、task.completed 轻量检查）。职责：发现「同一交付物/同一活动/同一数据源」的任务，产出合并推进建议（一句话，口语）；自动 run 只产建议，不动数据、不碰 ui 工具。
### 6.3 小派 orchestrator（主对话）
harness 全工具白名单（除自动触发限制），核心 `list_tasks / get_task / update_task / complete_task / create_tasks / draft_user_prompt / draft_message / remember / recall / reveal_card / open_tool_site / dispatch`。人设：靠谱同事小派——说人话、短句、先给结论、适度幽默、绝不说教；汇报完成→先确认划掉再建议下一件（优先 fit=full）；教做法永远 3 步以内；重活委派给拆解官/汇报官（dispatch）。
### 6.4 汇报官 reporter
输入：`query_task_history(range)` + 工作日志 + 可选模板文本 + 用户称呼/部门。无模板默认结构：日报【今日完成/进行中/需协调/明日计划】、周报【本周成果/进行中/数据/风险与求助/下周计划】、月报【本月摘要/重点产出/下月目标】；有模板**严格套模板层级与口径**。风格：给领导看的——量化、结论先行、不堆形容词。

## 7. 右键收集与快捷键

contextMenus：选中文本右键「把选中内容加进派活儿」→ 打开侧边栏、文本进倒活框（不自动拆解）。commands：`Ctrl/Cmd+Shift+Y` 开关面板。

## 8. 文案与微交互原则

全部文案照抄原型（已打磨）：称呼用户为搭子式口吻、拒收文件说「.exe 这类文件帮不上忙」、完成有 check 弹跳+粒子、思考态用蓝色流光文字、toast 短句不装腔。新增文案遵循同一调性：**说人话、先结论、不吓人**。

## 9. v0.1 明确不做（防跑偏）

语音输入（按钮占位，点击 toast「下个版本」）、目标站自动填充提示词、飞书/钉钉版、多 key 路由、团队共享、云同步、深色模式、i18n、自动执行任务、商店上架（T18 停点单独做）。
