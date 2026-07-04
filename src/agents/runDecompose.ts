import { runAgent } from './harness/loop';
import { excerptFragment } from './harness/context';
import type { ToolRegistry } from './harness/tools';
import type { LlmDriver } from './harness/llmDriver';
import { buildDecomposerProfile, type DecomposerOutput } from './profiles/decomposer';
import { materializeDecomposerOutput, type MaterializeResult } from './materializeDecomposerOutput';
import type { AgentRun } from './harness/trace';
import type { Fragment, Task } from '@/src/store/schema';

export interface RunDecomposeDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
  existingTasks: Task[];
}

export interface RunDecomposeCallbacks {
  onDelta?: (text: string) => void;
}

export type RunDecomposeResult =
  | { ok: true; agentRun: AgentRun; materialized: MaterializeResult }
  | { ok: false; agentRun: AgentRun; error: string };

function describeRunError(agentRun: AgentRun): string {
  if (agentRun.error) {
    switch (agentRun.error.kind) {
      case 'unauthorized':
        return 'AI 平台说 key 不对——去设置里检查一下';
      case 'rate_limited':
        return '请求太频繁了，等几秒再试';
      case 'timeout':
        return '连接超时，检查网络后重试';
      case 'network':
        return '连不上 AI 平台，检查网络和接口地址';
      case 'aborted':
        return '已取消';
      default:
        return `拆解失败：${agentRun.error.message}`;
    }
  }
  return '拆解没有产出结果——多轮尝试都没能给出答案，换个说法或分开倒试试';
}

/** 拆解官链路的核心逻辑：跑一次 decomposer run，成功/降级都落库，失败返回友好错误文案 */
export async function runDecompose(
  fragment: Fragment,
  deps: RunDecomposeDeps,
  callbacks: RunDecomposeCallbacks = {},
): Promise<RunDecomposeResult> {
  const profile = buildDecomposerProfile(deps.existingTasks);
  const input = excerptFragment(fragment);

  const agentRun = await runAgent(
    profile,
    input,
    { registry: deps.registry, llm: deps.llm, defaultModel: deps.defaultModel },
    { onDelta: callbacks.onDelta },
  );

  if (agentRun.finalOutput !== undefined) {
    const materialized = materializeDecomposerOutput(agentRun.finalOutput as DecomposerOutput, fragment.id);
    return { ok: true, agentRun, materialized };
  }

  return { ok: false, agentRun, error: describeRunError(agentRun) };
}
