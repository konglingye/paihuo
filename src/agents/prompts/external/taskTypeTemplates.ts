import type { TaskType } from '@/src/store/schema';

/** 外部提示词模板骨架：角色/任务/格式/语气四段（arch §4 外部提示词） */
export interface PromptTemplateSkeleton {
  role: string;
  task: string;
  format: string;
  tone: string;
}

/** 用户必须补的信息一律写成【…】空槽（arch §4） */
export const TASK_TYPE_TEMPLATES: Record<TaskType, PromptTemplateSkeleton> = {
  write: {
    role: '你是资深文案/写作顾问。',
    task: '帮我写：【一句话说清要写什么、给谁看】',
    format: '篇幅：【字数或段落要求】；结构：【要点/小标题要求】',
    tone: '语气：【正式/轻松/带点幽默，按场合定】',
  },
  slide: {
    role: '你是资深演示设计顾问。',
    task: '帮我出一份 PPT 大纲：【主题 + 听众 + 场合】',
    format: '【页数】页以内；每页给标题 + 3 个要点 + 一句演讲提示',
    tone: '语气：务实、少形容词',
  },
  data: {
    role: '你是数据分析顾问。',
    task: '帮我处理这组数据：【数据是什么、想得到什么结论】',
    format: '给出具体步骤/公式，最后给 3 条一句话结论',
    tone: '语气：准确、不绕弯子',
  },
  comm: {
    role: '你是沟通表达顾问。',
    task: '帮我写一段要发给【对象】的消息：【想说清楚的事】',
    format: '控制在几句话以内，说清楚事实和诉求',
    tone: '语气：得体、不卑不亢',
  },
  misc: {
    role: '你是靠谱的通用助手。',
    task: '帮我：【具体想做的事】',
    format: '按事情本身的要求来，不啰嗦',
    tone: '语气：直接、说人话',
  },
};

export function composePromptText(skeleton: PromptTemplateSkeleton): string {
  return [skeleton.role, skeleton.task, skeleton.format, skeleton.tone].join('\n');
}
