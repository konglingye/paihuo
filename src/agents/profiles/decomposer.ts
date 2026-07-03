import { z } from 'zod';
import type { AgentProfile } from '../harness/loop';
import { assembleSystemPrompt } from '../prompts/assemble';
import { buildIdentityBlock } from '../prompts/blocks/identity';
import { buildToolPolicyBlock } from '../prompts/blocks/toolPolicy';
import { buildStateBlock } from '../prompts/blocks/state';
import { buildContractBlock } from '../prompts/blocks/contract';
import { buildStyleBlock } from '../prompts/blocks/style';
import { buildMemoryBlock } from '../prompts/blocks/memory';
import { GroupKindSchema, TaskDraftSchema } from '@/src/store/schema';
import type { Task } from '@/src/store/schema';

/** 拆解官的任务草稿：比落库用的 TaskDraft 少 fragmentId（调用方已知道，不用模型编）， 多 localId（供同一次输出内部互相引用） */
export const DecomposerTaskDraftSchema = TaskDraftSchema.omit({ fragmentId: true }).extend({
  localId: z.string(),
});

export const DecomposerGroupDraftSchema = z.object({
  localId: z.string(),
  label: z.string(),
  kind: GroupKindSchema,
});

export const DecomposerRelateSchema = z.object({
  aIds: z.array(z.string()).min(2),
  reason: z.string(),
  suggestion: z.string(),
});

/** 拆解官输出契约（spec §6.1） */
export const DecomposerOutputSchema = z.object({
  tasks: z.array(DecomposerTaskDraftSchema),
  groups: z.array(DecomposerGroupDraftSchema),
  relates: z.array(DecomposerRelateSchema),
});
export type DecomposerOutput = z.infer<typeof DecomposerOutputSchema>;

const CONTRACT_DESCRIPTION = `{
  "tasks": [{ "localId": string, "title": string, "type": "write"|"slide"|"data"|"comm"|"misc",
              "fit": "full"|"assist"|"self", "toolId"?: string, "prompt"?: string,
              "due"?: { "text": string, "hot": boolean }, "groupId"?: string, "saveMin": number }],
  "groups": [{ "localId": string, "label": string, "kind": "urgent"|"project"|"daily" }],
  "relates": [{ "aIds": string[], "reason": string, "suggestion": string }]
}`;

/** 契约两次都校验失败时的降级路径：把原文塞一张"待手动拆"卡，而不是整个 run 报错 */
function fallbackToManualCard(rawText: string): DecomposerOutput {
  return {
    tasks: [
      {
        localId: 'manual-1',
        title: `待手动拆：${rawText.slice(0, 40)}`,
        type: 'misc',
        fit: 'self',
        saveMin: 0,
      },
    ],
    groups: [],
    relates: [],
  };
}

export function buildDecomposerProfile(existingTasks: Task[]): AgentProfile {
  return {
    name: 'decomposer',
    toolNames: ['search_tool_catalog', 'read_attachment'],
    maxTurns: 6,
    outputContract: DecomposerOutputSchema,
    fallback: fallbackToManualCard,
    params: { temperature: 0.7 },
    systemPrompt: assembleSystemPrompt({
      identity: buildIdentityBlock({
        name: '拆解官',
        persona: '你负责把领导甩过来的活儿、会议记录或随手一句话，拆解成一张张可交付的任务卡。',
      }),
      toolPolicy: buildToolPolicyBlock([
        'toolId 必须来自 search_tool_catalog 检索到的结果，选不出合适的工具就留空，并把 fit 降级为 self',
        '附件或原文很长时用 read_attachment 分块读完，不要凭印象瞎编内容',
      ]),
      state: buildStateBlock(existingTasks),
      contract: buildContractBlock(CONTRACT_DESCRIPTION),
      style: buildStyleBlock([
        '标题必须是动词开头的交付物，不是模糊的事项描述',
        'fit 三档宁保守不吹牛：AI 只能起草的算 assist，不算 full',
        '每条 prompt 里用户必须补充的信息一律写成【…】空槽',
        'saveMin 保守估计；due 提不出来就留空，不要瞎猜',
      ]),
      memory: buildMemoryBlock(),
    }),
  };
}
