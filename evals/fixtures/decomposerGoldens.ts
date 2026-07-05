/**
 * 拆解 evals 的金标准场景（arch §7）：≥6 段"领导原话"，覆盖带附件/带干扰闲聊/超长版等情形。
 * mockOutput 是这段话"应该"被拆成什么样的人工标注结果——mock 通道下用来验证 pipeline（契约校验+
 * 落库）和结构性规则（空槽/toolId 在目录内/due 正确/fit 不虚高）始终成立；真模型通道（T24 之后）
 * 用同一套输入换真 key 跑，人工比对真实产出跟这份标注的接近程度。
 */
import type { DecomposerOutput } from '@/src/agents/profiles/decomposer';

export interface DecomposerGolden {
  id: string;
  description: string;
  rawText: string;
  attachmentText?: string;
  /** 这段话应该拆出的任务数区间（人工标注，宽松范围，允许模型判断略有出入） */
  expectedTaskCountRange: [number, number];
  mockOutput: DecomposerOutput;
}

export const DECOMPOSER_GOLDENS: DecomposerGolden[] = [
  {
    id: 'launch-event',
    description: '发布会四事项——原型剧本①，任务类型/fit 分布最全的基准场景',
    rawText:
      '小李，几个事：下周一发布会上给经销商讲渠道政策的PPT你准备一下；今天的会整理个纪要，下班前发群里；上季度各区域销售数据汇总个表给我；发布会的宣传文案先出两版看看。',
    expectedTaskCountRange: [4, 4],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '整理今天的会议纪要，下班前发群里',
          type: 'write',
          fit: 'full',
          toolId: 'doubao',
          prompt: '把下面的会议转写整理成一份能直接发群里的纪要，开头讲清结论。\n转写原文：【粘贴转写文字】',
          due: { text: '今天 18:00', hot: true },
          saveMin: 40,
        },
        {
          localId: 'n2',
          title: '发布会 PPT：给经销商讲渠道政策',
          type: 'slide',
          fit: 'assist',
          toolId: 'kimi',
          prompt: '帮我出一份渠道政策宣讲 PPT 大纲。\n背景：【一句话说清产品和政策变化】',
          groupId: 'g1',
          saveMin: 90,
        },
        {
          localId: 'n3',
          title: '发布会宣传文案，先出两版',
          type: 'write',
          fit: 'full',
          toolId: 'deepseek',
          prompt: '写两版新品发布会宣传文案。\n产品卖点：【一句话卖点】',
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
      relates: [{ aIds: ['n2', 'n3'], reason: '用的是同一套信息', suggestion: '先定关键信息' }],
    },
  },
  {
    id: 'with-attachment',
    description: '带附件——原话里提到"附件"，任务描述依赖附件内容',
    rawText: '帮我看下附件里的合作方案初稿，按咱们上次谈的几个点改一版发我，今天下班前要。',
    attachmentText: '《XX合作方案》初稿：合作模式、分成比例、执行周期……',
    expectedTaskCountRange: [1, 1],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '按谈好的要点修改合作方案初稿',
          type: 'write',
          fit: 'assist',
          toolId: 'doubao',
          prompt:
            '帮我根据下面的修改意见调整这份合作方案初稿：\n修改要点：【列出上次谈的几个修改点】\n原方案：【粘贴附件内容】',
          due: { text: '今天 18:00', hot: true },
          saveMin: 35,
        },
      ],
      groups: [],
      relates: [],
    },
  },
  {
    id: 'with-chitchat',
    description: '带干扰闲聊——夹杂跟工作无关的话，拆解不应该把闲聊也当成任务',
    rawText:
      '哎对了，周末部门聚餐定了没？算了不管了，回头再说。麻烦你把咱们下季度的培训计划整理成一份文档发我；另外提醒一下老王，周五之前把新员工入职材料准备好。',
    expectedTaskCountRange: [2, 2],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '整理下季度培训计划文档',
          type: 'write',
          fit: 'assist',
          toolId: 'doubao',
          prompt: '帮我把下季度培训计划整理成一份文档。\n培训内容：【列出计划涵盖的主题和时间安排】',
          saveMin: 45,
        },
        {
          localId: 'n2',
          title: '提醒老王周五前准备好新员工入职材料',
          type: 'comm',
          fit: 'self',
          prompt: '老王，麻烦周五之前把新员工入职材料准备一下，谢谢！',
          due: { text: '周五之前', hot: false },
          saveMin: 5,
        },
      ],
      groups: [],
      relates: [],
    },
  },
  {
    id: 'super-long-transcript',
    description: '超长版——模拟一段冗长的会议转写，任务藏在大段流水账中间',
    rawText: [
      '好那我们开始吧，今天主要过一下三件事。',
      '第一，上周客户那边反馈说我们的响应速度有点慢，具体是哪几个客户我等下让小张把名单发一下，大家先记着这个事，回头看看是不是流程上有问题。',
      '然后呢，中间还有个事顺便说一下，就是茶水间的咖啡机好像坏了，谁负责报修一下，这个不着急。',
      '第二件事，市场那边说这个月月底要出一份月度复盘报告，格式跟上个月一样就行，麻烦老陈这周五之前把初稿写出来，我们再一起看一下。',
      '第三，招聘那边有个候选人周四要来面试，麻烦人事把面试安排（时间、地点、面试官）整理一下发给候选人确认，顺便抄送我一份。',
      '大概就这些，大家有问题吗？没有的话就先这样。',
    ].join('\n'),
    expectedTaskCountRange: [2, 3],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '写出月度复盘报告初稿',
          type: 'write',
          fit: 'assist',
          toolId: 'doubao',
          prompt: '帮我按上个月的格式写一份月度复盘报告初稿。\n本月数据和重点事项：【粘贴本月关键数据】',
          due: { text: '周五之前', hot: false },
          groupId: 'g1',
          saveMin: 60,
        },
        {
          localId: 'n2',
          title: '整理候选人面试安排并发送确认',
          type: 'comm',
          fit: 'full',
          toolId: 'deepseek',
          prompt: '帮我写一条面试安排确认消息发给候选人。\n面试信息：【时间、地点、面试官姓名】',
          due: { text: '周四', hot: true },
          saveMin: 15,
        },
      ],
      groups: [{ localId: 'g1', label: '月度复盘', kind: 'daily' }],
      relates: [],
    },
  },
  {
    id: 'fit-conservative-strategy',
    description: 'fit 保守性——需要业务判断的策略调整不能标 full，纯翻译这类可以标 full',
    rawText:
      '根据这两周收集到的用户反馈，帮我重新想一下下个版本的定价策略要怎么调整；另外把这封客户的英文邮件翻译成中文发我看看。',
    expectedTaskCountRange: [2, 2],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '基于用户反馈起草定价策略调整方向',
          type: 'data',
          fit: 'assist',
          toolId: 'deepseek',
          prompt: '基于下面的用户反馈，帮我梳理定价策略可能的调整方向（仅供参考，最终判断我来定）。\n反馈汇总：【粘贴用户反馈要点】',
          saveMin: 40,
        },
        {
          localId: 'n2',
          title: '把客户英文邮件翻译成中文',
          type: 'write',
          fit: 'full',
          toolId: 'youdao',
          prompt: '把下面这封英文邮件翻译成中文，保持商务邮件的语气。\n原文：【粘贴英文邮件全文】',
          saveMin: 10,
        },
      ],
      groups: [],
      relates: [],
    },
  },
  {
    id: 'multiple-due-dates',
    description: '多个明确截止日期——验证 due 提取的准确性（不同任务对应不同日期）',
    rawText: '周三下午 5 点前把季度总结提交给财务；周五之前把会议室这周的预定表理一下发我；这个月底之前把年度述职 PPT 框架搭好。',
    expectedTaskCountRange: [3, 3],
    mockOutput: {
      tasks: [
        {
          localId: 'n1',
          title: '把季度总结提交给财务',
          type: 'write',
          fit: 'self',
          prompt: '附件是本季度总结，麻烦查收，谢谢！',
          due: { text: '周三 17:00', hot: true },
          saveMin: 5,
        },
        {
          localId: 'n2',
          title: '整理本周会议室预定表',
          type: 'data',
          fit: 'assist',
          toolId: 'doubao',
          prompt: '帮我把这周会议室的预定情况整理成一张表。\n预定记录：【粘贴预定记录】',
          due: { text: '周五之前', hot: false },
          saveMin: 20,
        },
        {
          localId: 'n3',
          title: '搭好年度述职 PPT 框架',
          type: 'slide',
          fit: 'assist',
          toolId: 'kimi',
          prompt: '帮我搭一个年度述职 PPT 的框架大纲。\n本年度重点工作：【列出 3-5 项重点产出】',
          due: { text: '月底之前', hot: false },
          saveMin: 50,
        },
      ],
      groups: [],
      relates: [],
    },
  },
];
