import { runAgent } from './harness/loop';
import { buildOrchestratorProfile } from './profiles/orchestrator';
import type { ToolRegistry } from './harness/tools';
import type { LlmDriver } from './harness/llmDriver';
import type { AgentRun } from './harness/trace';
import type { ChatMessage } from '@/src/llm/types';
import type { Task } from '@/src/store/schema';

export interface RunChatDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
  existingTasks: Task[];
}

export interface RunChatCallbacks {
  onDelta?: (text: string) => void;
  onToolCall?: (calls: { name: string; args: unknown }[]) => void;
  signal?: AbortSignal;
}

export type RunChatResult =
  | { ok: true; agentRun: AgentRun; text: string }
  | { ok: false; agentRun: AgentRun; error: string };

function describeChatError(agentRun: AgentRun): string {
  if (agentRun.outcome === 'aborted') return '已取消';
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
      default:
        return `出了点问题：${agentRun.error.message}`;
    }
  }
  return '这次没能收尾——多轮尝试都没给出回复，换个说法再问我一次';
}

/**
 * 小派主对话链路的核心逻辑：跑一次 orchestrator run，续接既往轮次。
 * allowUiExternal 恒为 true——聊天本来就是用户刚发消息触发的，ui 工具（reveal_card 等）应该能直接执行。
 * orchestrator 没有 outputContract，终局是纯文本：outcome==='text' 才算成功，其余（bailout/error/aborted）都走友好错误文案。
 */
export async function runChat(
  input: string,
  history: ChatMessage[],
  deps: RunChatDeps,
  callbacks: RunChatCallbacks = {},
): Promise<RunChatResult> {
  const profile = buildOrchestratorProfile(deps.existingTasks);
  const agentRun = await runAgent(
    profile,
    input,
    {
      registry: deps.registry,
      llm: deps.llm,
      defaultModel: deps.defaultModel,
      allowUiExternal: true,
    },
    {
      history,
      onDelta: callbacks.onDelta,
      onToolCall: callbacks.onToolCall,
      signal: callbacks.signal,
    },
  );

  if (agentRun.outcome === 'text') {
    return { ok: true, agentRun, text: agentRun.finalText };
  }
  return { ok: false, agentRun, error: describeChatError(agentRun) };
}
