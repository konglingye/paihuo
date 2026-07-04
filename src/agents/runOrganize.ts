import { runAgent } from './harness/loop';
import { buildStateSnapshotBlock } from './harness/context';
import { buildOrganizerProfile, type OrganizerOutput } from './profiles/organizer';
import { useRelationsStore } from '@/src/store/relationsStore';
import type { ToolRegistry } from './harness/tools';
import type { LlmDriver } from './harness/llmDriver';
import type { AgentRun } from './harness/trace';
import type { Relation, Task } from '@/src/store/schema';

export interface RunOrganizeDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
}

export interface RunOrganizeResult {
  agentRun: AgentRun;
  relations: Relation[];
}

/**
 * 手动触发一次整理官（事件自动触发是 T17 的事）：
 * 看当前任务板有没有能合并推进的，命中的落成 relationsStore 记录。
 * 整理官处理的是已经存在的真实任务，taskIds 本来就是真实 id，不需要像拆解官那样做 localId 映射。
 */
export async function runOrganize(tasks: Task[], deps: RunOrganizeDeps): Promise<RunOrganizeResult> {
  const profile = buildOrganizerProfile(tasks);
  // 把状态快照也塞进 user 输入，方便模型（和 mock fixture）直接引用里面的真实 task id
  const input = `找找现有任务里有没有能合并推进的。\n${buildStateSnapshotBlock(tasks)}`;

  const agentRun = await runAgent(profile, input, {
    registry: deps.registry,
    llm: deps.llm,
    defaultModel: deps.defaultModel,
  });

  if (agentRun.finalOutput === undefined) {
    return { agentRun, relations: [] };
  }

  const output = agentRun.finalOutput as OrganizerOutput;
  const relations = output.suggestions
    .filter((s) => s.taskIds.length >= 2)
    .map((s) =>
      useRelationsStore.getState().addRelation({
        taskIds: s.taskIds,
        reason: s.reason,
        suggestion: s.suggestion,
      }),
    );

  return { agentRun, relations };
}
