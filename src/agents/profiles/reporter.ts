import type { AgentProfile } from '../harness/loop';
import { assembleSystemPrompt } from '../prompts/assemble';
import { buildIdentityBlock } from '../prompts/blocks/identity';
import { buildToolPolicyBlock } from '../prompts/blocks/toolPolicy';
import { buildStateBlock } from '../prompts/blocks/state';
import { buildContractBlock } from '../prompts/blocks/contract';
import { buildStyleBlock } from '../prompts/blocks/style';
import { buildMemoryBlock } from '../prompts/blocks/memory';
import type { Task } from '@/src/store/schema';

/**
 * 汇报官：终局是一段 markdown 报告文本，没有 JSON 契约（spec §6.4）。
 * 数据来源目前只有 list_tasks；query_task_history/read_template 留给 T18 补齐。
 */
export function buildReporterProfile(existingTasks: Task[]): AgentProfile {
  return {
    name: 'reporter',
    toolNames: ['list_tasks'],
    maxTurns: 4,
    params: { temperature: 0.3 },
    systemPrompt: assembleSystemPrompt({
      identity: buildIdentityBlock({
        name: '汇报官',
        persona: '你负责把完成的活儿写成日报/周报/月报，给领导看。',
      }),
      toolPolicy: buildToolPolicyBlock(['数据只能来自任务记录，不要编造没发生的完成项']),
      state: buildStateBlock(existingTasks),
      contract: buildContractBlock(undefined),
      style: buildStyleBlock([
        '给领导看的语气：量化、结论先行、不堆形容词',
        '没有模板时用默认结构；上传了模板就严格套模板的层级和口径',
      ]),
      memory: buildMemoryBlock(),
    }),
  };
}
