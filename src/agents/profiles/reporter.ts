import type { AgentProfile } from '../harness/loop';
import { assembleSystemPrompt } from '../prompts/assemble';
import { buildIdentityBlock } from '../prompts/blocks/identity';
import { buildToolPolicyBlock } from '../prompts/blocks/toolPolicy';
import { buildStateBlock } from '../prompts/blocks/state';
import { buildContractBlock } from '../prompts/blocks/contract';
import { buildStyleBlock } from '../prompts/blocks/style';
import { buildMemoryBlock } from '../prompts/blocks/memory';
import { useMemoryStore } from '@/src/store/memoryStore';
import type { Task } from '@/src/store/schema';
import type { WorklogEntry } from '@/src/store/worklogStore';

export interface ReporterContext {
  worklogEntries?: WorklogEntry[];
  userName?: string;
  org?: string;
  /** 当前有没有上传公司模板——只传名字，模板全文靠 read_template 工具按需读取（检索优先于灌注） */
  templateName?: string;
}

/** 汇报官的"背景"追加段：用户身份 + 最近工作日志 + 有没有模板，拼进 state 块（spec §6.4 的输入清单） */
function buildReporterContextText(context: ReporterContext): string {
  const parts: string[] = [];

  const identityLines = [
    context.userName && `称呼：${context.userName}`,
    context.org && `部门：${context.org}`,
  ].filter(Boolean);
  if (identityLines.length > 0) parts.push(`# 用户信息\n${identityLines.join('\n')}`);

  if (context.worklogEntries && context.worklogEntries.length > 0) {
    const lines = context.worklogEntries.map((e) => `- ${e.date}：${e.summary}`).join('\n');
    parts.push(`# 最近工作日志\n${lines}`);
  }

  parts.push(
    context.templateName
      ? `# 模板\n已上传模板「${context.templateName}」——写之前先调 read_template 读取全文，严格套用它的层级结构和措辞口径`
      : '# 模板\n没有上传模板，按默认结构写',
  );

  return parts.join('\n\n');
}

/**
 * 汇报官：终局是一段 markdown 报告文本，没有 JSON 契约（spec §6.4）。
 * 数据来源：query_task_history(range) 按时间范围查完成/进行中情况 + read_template 按需读模板全文。
 */
export function buildReporterProfile(existingTasks: Task[], context: ReporterContext = {}): AgentProfile {
  return {
    name: 'reporter',
    toolNames: ['query_task_history', 'read_template'],
    maxTurns: 4,
    params: { temperature: 0.3 },
    systemPrompt: assembleSystemPrompt({
      identity: buildIdentityBlock({
        name: '汇报官',
        persona: '你负责把完成的活儿写成日报/周报/月报，给领导看。',
      }),
      toolPolicy: buildToolPolicyBlock([
        '数据只能来自 query_task_history 和工作日志，不要编造没发生的完成项',
        '没有模板时：日报用【今日完成/进行中/需协调/明日计划】，周报用【本周成果/进行中/数据/风险与求助/下周计划】，月报用【本月摘要/重点产出/下月目标】',
        '如果调用 read_template 读到了模板内容，必须严格套用模板的层级结构和措辞口径，不能再用默认结构',
      ]),
      state: buildStateBlock(existingTasks, buildReporterContextText(context)),
      contract: buildContractBlock(undefined),
      style: buildStyleBlock(['给领导看的语气：量化、结论先行、不堆形容词']),
      memory: buildMemoryBlock(useMemoryStore.getState().profileText()),
    }),
  };
}
