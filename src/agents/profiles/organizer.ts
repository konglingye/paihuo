import { z } from 'zod';
import type { AgentProfile } from '../harness/loop';
import { assembleSystemPrompt } from '../prompts/assemble';
import { buildIdentityBlock } from '../prompts/blocks/identity';
import { buildToolPolicyBlock } from '../prompts/blocks/toolPolicy';
import { buildStateBlock } from '../prompts/blocks/state';
import { buildContractBlock } from '../prompts/blocks/contract';
import { buildStyleBlock } from '../prompts/blocks/style';
import { buildMemoryBlock } from '../prompts/blocks/memory';
import type { Task } from '@/src/store/schema';

/** 整理官输出契约（spec §6.2：产合并推进建议，事件触发，自动 run 只产建议不动数据） */
export const OrganizerOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      taskIds: z.array(z.string()).min(2),
      reason: z.string(),
      suggestion: z.string(),
    }),
  ),
});
export type OrganizerOutput = z.infer<typeof OrganizerOutputSchema>;

const CONTRACT_DESCRIPTION = `{ "suggestions": [{ "taskIds": string[], "reason": string, "suggestion": string }] }`;

export function buildOrganizerProfile(existingTasks: Task[]): AgentProfile {
  return {
    name: 'organizer',
    toolNames: ['list_tasks', 'get_task'],
    maxTurns: 4,
    outputContract: OrganizerOutputSchema,
    fallback: () => ({ suggestions: [] }),
    params: { temperature: 0.5 },
    systemPrompt: assembleSystemPrompt({
      identity: buildIdentityBlock({
        name: '整理官',
        persona: '你负责发现"同一交付物/同一活动/同一数据源"的任务，提醒用户合并推进。',
      }),
      toolPolicy: buildToolPolicyBlock([
        '自动触发时只能产出建议文本，不能调用会修改数据或打开外部页面的工具',
        '找不到明显关联就返回空的 suggestions 数组，不要硬凑',
      ]),
      state: buildStateBlock(existingTasks),
      contract: buildContractBlock(CONTRACT_DESCRIPTION),
      style: buildStyleBlock(['建议一句话、口语化，不说套话']),
      memory: buildMemoryBlock(),
    }),
  };
}
