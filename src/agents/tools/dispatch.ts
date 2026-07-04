import { z } from 'zod';
import { useTasksStore } from '@/src/store/tasksStore';
import { runAgent, type AgentProfile } from '../harness/loop';
import { buildDecomposerProfile } from '../profiles/decomposer';
import { buildOrganizerProfile } from '../profiles/organizer';
import { buildReporterProfile } from '../profiles/reporter';
import type { ToolDefinition, ToolRegistry } from '../harness/tools';
import type { LlmDriver } from '../harness/llmDriver';
import type { Task } from '@/src/store/schema';

const PROFILE_BUILDERS: Record<'decomposer' | 'organizer' | 'reporter', (tasks: Task[]) => AgentProfile> = {
  decomposer: buildDecomposerProfile,
  organizer: buildOrganizerProfile,
  reporter: buildReporterProfile,
};

const DispatchParams = z.object({
  agent: z.enum(['decomposer', 'organizer', 'reporter']),
  input: z.string(),
});

export interface DispatchToolDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
}

/**
 * orchestrator 委派子代理（arch §2 调度域）：同一 harness 递归跑一次。
 * 深度天然 ≤1——decomposer/organizer/reporter 的工具白名单里都没有 dispatch，无法再往下委派。
 */
export function createDispatchTool(deps: DispatchToolDeps): ToolDefinition<z.infer<typeof DispatchParams>> {
  return {
    name: 'dispatch',
    description: '把拆解/整理/汇报这类重活委派给对应的子代理去做（agent 只能是 decomposer/organizer/reporter）',
    paramsSchema: DispatchParams,
    effect: 'write',
    handler: async ({ agent, input }) => {
      const existingTasks = Object.values(useTasksStore.getState().tasks);
      const profile = PROFILE_BUILDERS[agent](existingTasks);
      const subRun = await runAgent(profile, input, {
        registry: deps.registry,
        llm: deps.llm,
        defaultModel: deps.defaultModel,
      });
      return {
        agent,
        outcome: subRun.outcome,
        finalOutput: subRun.finalOutput ?? subRun.finalText,
        error: subRun.error,
      };
    },
  };
}
