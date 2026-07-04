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
  /** 只有真的报错（网络/超时/401/429…）才有；契约降级/正常返回空建议都不算错误，不设这个字段 */
  error?: string;
}

/** LLM 真报错时的友好文案——不能让"没找到关联"和"key 失效/限流"用同一句话糊弄用户 */
function describeOrganizeError(agentRun: AgentRun): string | undefined {
  if (!agentRun.error) return undefined;
  switch (agentRun.error.kind) {
    case 'unauthorized':
      return 'AI 平台说 key 不对——去设置里检查一下';
    case 'rate_limited':
      return '请求太频繁了，等几秒再试';
    case 'timeout':
      return '连接超时，检查网络后重试';
    case 'network':
      return '连不上 AI 平台，检查网络和接口地址';
    default:
      return `出了点问题：${agentRun.error.message}`;
  }
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
    return { agentRun, relations: [], error: describeOrganizeError(agentRun) };
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
