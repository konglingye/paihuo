import type { ChatMessage, Usage } from '@/src/llm/types';

export interface LlmFixtureToolCall {
  name: string;
  args: unknown;
}

export interface LlmFixtureStep {
  /** 分片模拟——每个字符串是一次 onDelta 增量 */
  chunks?: string[];
  /** 需要根据输入动态拼答案时用这个（比如从状态快照里抠出真实 task id），优先于 chunks */
  respond?: (lastUserMessage: string, messages: ChatMessage[]) => string[];
  /** 这一步模拟的工具调用；静态数组或根据消息动态生成（比如从 system 里的状态快照抠真实 task id） */
  toolCalls?: LlmFixtureToolCall[] | ((lastUserMessage: string, messages: ChatMessage[]) => LlmFixtureToolCall[]);
}

export interface LlmFixture {
  id: string;
  /** 命中最后一条用户消息即选用该 fixture；未命中任何 fixture 时退回 DEFAULT_FIXTURE */
  match?: (lastUserMessage: string) => boolean;
  /** 分片模拟——每个字符串是一次 onDelta 增量。单轮场景的简写，等价于 steps: [{ chunks }] */
  chunks?: string[];
  /** 需要根据输入动态拼答案时用这个，优先于 chunks。单轮场景的简写，等价于 steps: [{ respond }] */
  respond?: (lastUserMessage: string, messages: ChatMessage[]) => string[];
  /** 多轮场景（比如先调工具、拿到结果后再给文本结论）用这个；每轮按"已经产生的 tool 结果数"挑对应 step */
  steps?: LlmFixtureStep[];
  usage?: Usage;
  /** 每个分片之间的模拟延迟（毫秒），默认 10 */
  delayMs?: number;
}

export const DEFAULT_FIXTURE: LlmFixture = {
  id: 'default-greeting',
  chunks: ['收到，', '我先看看能帮你做点什么。'],
  usage: { promptTokens: 20, completionTokens: 12, totalTokens: 32 },
};

/** 原型剧本①的领导原话，dev trace 页「跑一次 decomposer」按钮用的就是这句 */
export const DECOMPOSER_SAMPLE_INPUT =
  '小李，几个事：下周一发布会上给经销商讲渠道政策的PPT你准备一下；今天的会整理个纪要，下班前发群里；上季度各区域销售数据汇总个表给我；发布会的宣传文案先出两版看看。';

/** 拆解官输出契约（spec §6.1）的发布会四任务剧本，跟原型 seedTasks/newTasks 对齐 */
const DECOMPOSER_LAUNCH_EVENT_OUTPUT = {
  tasks: [
    {
      localId: 'n1',
      title: '整理今天的会议纪要，下班前发群里',
      type: 'write',
      fit: 'full',
      toolId: 'doubao',
      prompt:
        '把下面的会议转写整理成一份能直接发群里的纪要：\n1. 开头 5 行以内讲清结论；\n2. 「待办」用表格列：事项 / 负责人 / 截止时间；\n3. 有分歧或风险的单独列出来。\n转写原文：【粘贴飞书妙记的转写文字】',
      due: { text: '今天 18:00', hot: true },
      saveMin: 40,
    },
    {
      localId: 'n2',
      title: '发布会 PPT：给经销商讲渠道政策',
      type: 'slide',
      fit: 'assist',
      toolId: 'aippt',
      prompt:
        '你是资深渠道运营。帮我出一份"下半年渠道政策宣讲"PPT 大纲，听众是经销商，场合是下周一的新品发布会。\n背景：【一句话说清产品和这次政策变化，如：返点调整 / 订货激励】\n要求：10 页以内；每页给标题 + 3 个要点 + 一句演讲提示。',
      groupId: 'g1',
      saveMin: 90,
    },
    {
      localId: 'n3',
      title: '发布会宣传文案，先出两版',
      type: 'write',
      fit: 'full',
      toolId: 'deepseek',
      prompt:
        '写两版新品发布会宣传文案：\nA 版发朋友圈，100 字内，正式；\nB 版发公众号开头，150 字内，轻松带钩子。\n产品卖点：【一句话，如：一台顶三台的家用清洁机】\n两版结尾都带发布会信息：【时间 · 地点】',
      groupId: 'g1',
      saveMin: 50,
    },
    {
      localId: 'n4',
      title: '汇总上季度各区域销售数据',
      type: 'data',
      fit: 'assist',
      saveMin: 30,
    },
  ],
  groups: [{ localId: 'g1', label: '下周一 · 新品发布会', kind: 'project' }],
  relates: [
    {
      aIds: ['n2', 'n3'],
      reason: '发布会 PPT 和宣传文案用的是同一套信息',
      suggestion: '先花 5 分钟定下：新品卖点、政策要点、时间地点，两份提示词一起生效',
    },
  ],
};

const decomposerJsonText = JSON.stringify(DECOMPOSER_LAUNCH_EVENT_OUTPUT);
const decomposerMid = Math.floor(decomposerJsonText.length / 2);

/** 状态快照块里一行形如 "- <id> [status] <title> fit=..."，从里面抠出指定标题对应的真实 task id */
function findTaskIdByTitleFragment(stateSnapshot: string, titleFragment: string): string | undefined {
  const line = stateSnapshot.split('\n').find((l) => l.includes(titleFragment));
  return line?.match(/^- (\S+) /)?.[1];
}

/** 小派（orchestrator）的状态快照在 system 提示词里（profile 组装时就定好了），不在 user 消息里，得从这里抠 */
function findTaskIdInSystemPrompt(messages: ChatMessage[], titleFragment: string): string | undefined {
  const systemText = messages.find((m) => m.role === 'system')?.content ?? '';
  return findTaskIdByTitleFragment(systemText, titleFragment);
}

/** system 提示词里有没有"已上传模板"提示（reporter.ts 的 buildReporterContextText 产出的那句） */
function hasUploadedTemplate(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === 'system' && m.content.includes('已上传模板'));
}

/**
 * 汇报官剧本通用形状（spec §6.4）：
 * 第 1 步：调 query_task_history；第 2 步：没模板直接给默认结构文本，有模板则改调 read_template；
 * 第 3 步：只有"有模板"分支会走到——read_template 结果已回来，给模板结构的文本。
 */
function reporterFixture(
  id: string,
  matchPhrase: string,
  range: 'today' | 'week' | 'month',
  defaultText: string,
  templateText: string,
): LlmFixture {
  return {
    id,
    match: (msg) => msg.includes(matchPhrase),
    steps: [
      { toolCalls: [{ name: 'query_task_history', args: { range } }] },
      {
        toolCalls: (_msg, messages) => (hasUploadedTemplate(messages) ? [{ name: 'read_template', args: {} }] : []),
        respond: (_msg, messages) => (hasUploadedTemplate(messages) ? [] : [defaultText]),
      },
      { chunks: [templateText] },
    ],
    usage: { promptTokens: 150, completionTokens: 120, totalTokens: 270 },
  };
}

const REPORTER_DAILY_DEFAULT =
  '【今日完成】\n1. 整理今天的会议纪要，下班前发群里\n\n【进行中】\n1. 发布会 PPT：给经销商讲渠道政策\n2. 发布会宣传文案，先出两版\n3. 汇总上季度各区域销售数据\n\n【需协调】\n（暂无）\n\n【明日计划】\n1. 上午定发布会三个关键信息，PPT 与宣传文案同步推进\n2. 销售数据汇总表出初版';

const REPORTER_DAILY_TEMPLATE =
  '# 日报\n## 完成事项\n- 整理今天的会议纪要，下班前发群里\n## 待办事项\n- 发布会 PPT、发布会宣传文案、销售数据汇总表\n## 备注\n（按公司模板格式输出，层级与默认结构不同）';

const REPORTER_WEEKLY_DEFAULT =
  '【本周成果】\n1. 整理今天的会议纪要，下班前发群里\n\n【进行中】\n1. 发布会 PPT：给经销商讲渠道政策\n2. 发布会宣传文案，先出两版\n3. 汇总上季度各区域销售数据\n\n【数据】\n本周完成 1 件；引入 AI 协助后节省约 40 分钟工时\n\n【下周计划】\n1. 周一交付发布会 PPT + 宣传文案两版\n2. 销售汇总表定稿并给出三条结论';

const REPORTER_MONTHLY_DEFAULT =
  '【本月摘要】\n围绕新品发布会与日常运营推进，重点产出：会议纪要机制化、渠道政策宣讲材料、发布会宣传物料。\n\n【重点产出】\n1. 整理今天的会议纪要，下班前发群里\n2. 发布会 PPT：给经销商讲渠道政策\n3. 发布会宣传文案，先出两版\n\n【下月目标】\n1. 发布会落地复盘\n2. 建立「AI 辅助工作」常规流程，沉淀提示词库';

const REPORTER_WEEKLY_TEMPLATE =
  '# 周报\n## 本周完成\n- 整理今天的会议纪要，下班前发群里\n## 下周安排\n- 发布会 PPT、宣传文案、销售汇总表\n## 备注\n（按公司模板格式输出，层级与默认结构不同）';

const REPORTER_MONTHLY_TEMPLATE =
  '# 月报\n## 本月摘要\n围绕新品发布会与日常运营推进\n## 下月目标\n- 发布会落地复盘\n- 建立 AI 辅助工作流程\n## 备注\n（按公司模板格式输出，层级与默认结构不同）';

export const FIXTURES: LlmFixture[] = [
  {
    id: 'orchestrator-meeting-done',
    match: (msg) => msg.includes('纪要') && msg.includes('发完'),
    // 第 1 步：先划掉对应任务；第 2 步（工具结果已回来）：给出结论文本，对应 arch §6 的活动指示+划卡剧本
    steps: [
      {
        toolCalls: (_msg, messages) => {
          const id = findTaskIdInSystemPrompt(messages, '会议纪要');
          return id ? [{ name: 'complete_task', args: { id } }] : [];
        },
      },
      {
        chunks: ['真棒，', '「会议纪要」给你划掉了 ✓ 赶在下班前搞定，稳。', '剩下的活儿里，建议下一个做「发布会宣传文案」——AI 能直接出两版初稿，顺利的话 5 分钟搞定。'],
      },
    ],
    usage: { promptTokens: 40, completionTokens: 24, totalTokens: 64 },
  },
  {
    id: 'orchestrator-ppt-howto',
    match: (msg) => msg.includes('PPT') && (msg.includes('不知道') || msg.includes('怎么') || msg.includes('从哪')),
    // 第 1 步：先带用户跳到那张卡；第 2 步：给 3 步教学
    steps: [
      {
        toolCalls: (_msg, messages) => {
          const id = findTaskIdInSystemPrompt(messages, '发布会 PPT');
          return id ? [{ name: 'reveal_card', args: { taskId: id } }] : [];
        },
      },
      {
        chunks: [
          '最忌讳直接打开 PPT 软件硬想 :) 分三步：',
          '① 5 分钟定 3 个关键信息：新品卖点、政策要点、时间地点；',
          '② 用配好的提示词让 Kimi 出大纲，你只管删改；',
          '③ 满意了再让它逐页填内容。',
        ],
      },
    ],
    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
  },
  {
    id: 'decomposer-launch-event',
    match: (msg) => msg.includes('发布会') && msg.includes('纪要') && msg.includes('销售数据'),
    // 分两片模拟流式，拼起来才是合法 JSON
    chunks: [decomposerJsonText.slice(0, decomposerMid), decomposerJsonText.slice(decomposerMid)],
    usage: { promptTokens: 180, completionTokens: 220, totalTokens: 400 },
  },
  {
    id: 'organizer-find-relations',
    match: (msg) => msg.includes('合并推进'),
    respond: (msg) => {
      const pptId = findTaskIdByTitleFragment(msg, '发布会 PPT');
      const copyId = findTaskIdByTitleFragment(msg, '发布会宣传文案');
      const output =
        pptId && copyId
          ? {
              suggestions: [
                {
                  taskIds: [pptId, copyId],
                  reason: '发布会 PPT 和宣传文案用的是同一套信息',
                  suggestion: '先花 5 分钟定下：新品卖点、政策要点、时间地点，两份提示词一起生效',
                },
              ],
            }
          : { suggestions: [] };
      return [JSON.stringify(output)];
    },
    usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
  },
  reporterFixture('reporter-daily', '写一份日报', 'today', REPORTER_DAILY_DEFAULT, REPORTER_DAILY_TEMPLATE),
  reporterFixture('reporter-weekly', '写一份周报', 'week', REPORTER_WEEKLY_DEFAULT, REPORTER_WEEKLY_TEMPLATE),
  reporterFixture('reporter-monthly', '写一份月报', 'month', REPORTER_MONTHLY_DEFAULT, REPORTER_MONTHLY_TEMPLATE),
];

export function findFixture(lastUserMessage: string): LlmFixture {
  return FIXTURES.find((f) => f.match?.(lastUserMessage)) ?? DEFAULT_FIXTURE;
}
