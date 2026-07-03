import type { Usage } from '@/src/llm/types';

export interface LlmFixture {
  id: string;
  /** 命中最后一条用户消息即选用该 fixture；未命中任何 fixture 时退回 DEFAULT_FIXTURE */
  match?: (lastUserMessage: string) => boolean;
  /** 分片模拟——每个字符串是一次 onDelta 增量 */
  chunks: string[];
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
      toolId: 'gamma',
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

export const FIXTURES: LlmFixture[] = [
  {
    id: 'meeting-notes-done',
    match: (msg) => msg.includes('纪要') && msg.includes('发完'),
    chunks: ['真棒，', '这件事我先帮你划掉。', '接下来手里还有 3 件，要不要先看看今天能顺手做完的？'],
    usage: { promptTokens: 40, completionTokens: 24, totalTokens: 64 },
  },
  {
    id: 'decomposer-launch-event',
    match: (msg) => msg.includes('发布会') && msg.includes('纪要') && msg.includes('销售数据'),
    // 分两片模拟流式，拼起来才是合法 JSON
    chunks: [decomposerJsonText.slice(0, decomposerMid), decomposerJsonText.slice(decomposerMid)],
    usage: { promptTokens: 180, completionTokens: 220, totalTokens: 400 },
  },
];

export function findFixture(lastUserMessage: string): LlmFixture {
  return FIXTURES.find((f) => f.match?.(lastUserMessage)) ?? DEFAULT_FIXTURE;
}
