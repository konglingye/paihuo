# 派活儿 · 开发计划（Goal 运行手册）v1.0

> 执行者：Claude（Sonnet 5）持续循环。协议见 `CLAUDE.md`；产品语义见 `docs/00-product-spec.md`（下称 spec）；UI 对照 `prototype/paihuo-prototype.html`（下称原型）。

## 总目标（Definition of Victory）

一个可在 Chrome/Edge 开发者模式安装的 MV3 侧边栏插件 zip：用户按 3 步向导填自己的 key 后，能真实完成「倒活→拆解成带工具和提示词的任务卡→复制提示词跳转工具→对话汇报进度→生成日报周报」全链路；mock 模式下有 Playwright e2e 全链路回归；除 LLM 平台外零外部依赖、零后端。

## 运行规则（每轮循环）

1. 取下面**编号最小的未勾选**任务（依赖未满足则顺延）。
2. 写 3-5 行方案（涉及 UI 先看原型对应区块）。
3. TDD：先写测试（UI 任务允许"先实现后 Playwright 断言"，但 store/解析器/prompt 构造必须先测）。
4. 实现。
5. **真实验证到 DoD**（命令写在任务里；UI 任务必须 `pnpm dev` + Playwright 截图或明确的手动验证记录）。
6. 勾掉任务，在其下追加一行 `✅ YYYY-MM-DD 验证方式：…`，git commit。
7. 连续失败 3 次 / 触发停点 → 停下问用户。

**Mock 纪律**：T04 起所有 LLM 功能开发与 e2e 全部跑 `VITE_PAIHUO_MOCK=1`；真实 key 只在 T17（停点）使用。

## 任务清单

### M0 地基

- [ ] **T01 脚手架**：pnpm + WXT + React18 + TS + Tailwind；`entrypoints/sidepanel/`；action 点击开侧边栏；`manifest` 权限按 spec §2 最小集。
  DoD：`pnpm dev` 后在 Chrome 加载，侧边栏渲染三个 tab 壳与头部；`pnpm build` 零报错。
- [ ] **T02 设计令牌与基础组件**：把原型 `:root` 令牌迁入 Tailwind theme；实现 Button(主/幽灵)/Pill/Chip/Card/SegmentedTabs/Sheet(底部抽屉+scrim+把手)/Toast/进度环 8 个组件 + 内联 SVG 图标表（照抄原型 symbol）。
  DoD：dev-only `/components` 演示页与原型逐块目测一致（Playwright 截图留档 `docs/qa/`）。
- [ ] **T03 状态层**：zustand stores（settings/tasks/fragments/groups/reports/ui）+ persist 到 `chrome.storage.local` + `schemaVersion` 迁移；数据模型照 spec §4。
  DoD：vitest 覆盖 CRUD、持久化 roundtrip、迁移函数；`pnpm test` 绿。
- [ ] **T04 llmClient**：OpenAI 兼容流式 SSE、JSON 助手（失败重试 1 次）、错误分类（401/429/超时→友好文案）、`VITE_PAIHUO_MOCK=1` fixtures 通道（先造拆解/对话/汇报三份 fixture，内容抄原型演示剧本）。
  DoD：vitest 用本地 mock server 断言流式分片、JSON 修复、各错误路径；mock 通道单测绿。

### M1 接上 AI（引导是产品的一部分，认真做）

- [ ] **T05 设置向导**：3 步 UI 照原型；预设表与注册链接照 spec §3.4（`chrome.tabs.create` 打开注册页）；`/models` 拉取（带 /v1 探测回退）；推理模型识别规则 + 置顶 + 自动选中 + 非推理警告；测试连接（mock 下模拟成功/401/429 三态）。
  DoD：mock 下走完 3 步全流程 Playwright 断言；三种错误态有对应文案与"回到设置"引导。

### M2 核心循环：倒活→拆解→派活

- [ ] **T06 倒活输入区与附件**：textarea+粘贴/拖拽/按钮上传；白名单校验与拒收 toast；文本抽取（txt/md/pdf/docx/csv/xlsx）；附件 chip 可删。
  DoD：vitest 覆盖校验器与每种解析器（fixtures 各放一个样例文件）；UI 上传→chip→删除 Playwright 断言；传 `.exe` 被拒。
- [ ] **T07 拆解链路**：decompose prompt（spec §6.1，输出 schema 校验失败自动重试）；思考态流光文案两段；骨架屏→任务卡逐张入场；提示词空槽【…】渲染为高亮 mark。
  DoD：mock 下点「拆解」得到 4 张卡（分组/徽标/提示词与原型一致）；schema 校验单测绿。
- [ ] **T08 工具目录与卡片动作**：`tools.json`（spec §5 条目）+ `scripts/check-tools.ts`（逐条 fetch 核验 URL，失效项报告）；「复制提示词 · 打开工具」= clipboard + 新标签；「复制小抄」；「标记完成」+完成动效。
  DoD：`pnpm check:tools` 全绿（失效的当场替换）；Playwright 断言复制内容与开 tab 行为（mock tabs API）。
- [ ] **T09 分组/筛选/关联**：类型筛选 chips 带计数；分组头三态；organize 结果渲染关联横幅（两个按钮：进对话 / 关闭）。
  DoD：mock 下筛「演示」只剩 PPT 卡、计数正确；关联横幅出现且可关。

### M3 盯活：对话小派

- [ ] **T10 对话**：dock chips + 抽屉消息流 + 流式回复；function calling 五工具（spec §6.3）接通 store（划卡、加任务、重生成提示词生效于卡片）；附件消息；建议 chips 可执行。
  DoD：mock 剧本「会议纪要发完了」→ 卡片自动划掉+进度环更新；「PPT 怎么开始」→ 三步教学 + 「带我去那张卡」跳转高亮。
- [ ] **T11 总览页**：全部区块按 spec §3.1 动态化；空态引导；类型块/到期行跳转。
  DoD：拆解前后总览数字、类型计数、到期列表全部随 store 变化，Playwright 断言。

### M4 报活

- [ ] **T12 汇报页**：三种报告 prompt（spec §6.4）+ 模板上传解析注入 + 流式输出 + 复制/下载 .md；报告存 ReportRecord。
  DoD：mock 下三种报告可生成、模板上传后输出结构变化（fixture 里做区分）、下载文件内容正确。

### M5 收口

- [ ] **T13 右键收集与快捷键**：contextMenus 选中文本→侧边栏倒活框；`Cmd/Ctrl+Shift+Y` 开关面板。
  DoD：手动验证记录（步骤+结果）；权限清单没有超出 spec §2。
- [ ] **T14 打磨一轮**：空态/错误态全检、429/401 引导、reduced-motion、360-420px 宽度自适应、文案对照原型逐屏校对。
  DoD：对照 checklist（写进 `docs/qa/checklist.md`）逐项打勾。
- [ ] **T15 e2e 与 QA 手册**：Playwright 加载解包扩展跑 mock 全链路（配置→倒活→拆解→筛选→对话→汇报→重启后数据仍在）；手动 QA checklist 完稿。
  DoD：`pnpm e2e` 一条命令全绿。
- [ ] **T16 打包**：`pnpm zip` 产出 Chrome/Edge 安装包；README 写开发者模式安装图文与「3 步接 AI」用户指南；版本 0.1.0。
  DoD：zip 在干净 Chrome 实例安装成功并跑通 mock 链路。

### 停点任务（必须先问用户）

- [ ] **T17 ⛔ 真 key 冒烟**：向用户要一个 DeepSeek key → 真模型跑通拆解/对话/汇报，记录质量问题清单并修复（提示词允许迭代，schema 不变）。
- [ ] **T18 ⛔ 商店上架**：Edge Add-ons 优先（国内可访问）；素材、截图、隐私声明；需用户账号与付费决定。

## 里程碑验收

- M0-M1 完：能配置并"假装"连上模型（mock）。
- M2 完：核心价值可演示（拆解→复制提示词→跳工具）。
- M3-M4 完：五动词闭环。
- M5 完 + T17 过：可以发给真实用户试用。

## 风险备忘

- 各平台 `/models` 路径与鉴权差异 → llmClient 做探测回退，失败给"手填模型名"降级入口。
- CORS：个别平台可能拒绝扩展 origin → 用 background service worker 代发请求（host_permissions 已授权即可绕过），T04 就按此实现。
- 工具目录 URL 会过期 → `check:tools` 脚本纳入 e2e 前置。
- pdfjs/mammoth 包体较大 → 动态 import，只在用到时加载。
