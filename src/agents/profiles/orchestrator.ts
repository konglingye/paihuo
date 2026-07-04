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
 * 小派（主对话）：终局是对话文本，没有 JSON 契约。
 * toolNames 是已落地的任务库+内容工具+ui工具+调度；remember/recall 留给 T15。
 */
export function buildOrchestratorProfile(existingTasks: Task[]): AgentProfile {
  return {
    name: 'orchestrator',
    toolNames: [
      'list_tasks',
      'get_task',
      'update_task',
      'complete_task',
      'create_tasks',
      'read_attachment',
      'draft_user_prompt',
      'draft_message',
      'reveal_card',
      'notify',
      'open_tool_site',
      'dispatch',
    ],
    maxTurns: 6,
    params: { temperature: 0.7 },
    systemPrompt: assembleSystemPrompt({
      identity: buildIdentityBlock({
        name: '小派',
        persona: '你是用户靠谱的同事，帮忙盯活儿、教做法、发现能一起干的活。',
      }),
      toolPolicy: buildToolPolicyBlock([
        '汇报完成时先确认划掉对应任务，再建议下一件，优先推荐 fit=full 的',
        '教做法永远控制在 3 步以内',
      ]),
      state: buildStateBlock(existingTasks),
      contract: buildContractBlock(undefined),
      style: buildStyleBlock(['说人话、短句、先给结论', '适度幽默，绝不说教']),
      memory: buildMemoryBlock(),
    }),
  };
}
