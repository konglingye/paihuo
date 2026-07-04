import { runAgent } from './harness/loop';
import { buildReporterProfile, type ReporterContext } from './profiles/reporter';
import type { ToolRegistry } from './harness/tools';
import type { LlmDriver } from './harness/llmDriver';
import type { AgentRun } from './harness/trace';
import type { ReportKind, Task } from '@/src/store/schema';

export interface RunReportDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
  existingTasks: Task[];
  context?: ReporterContext;
}

export interface RunReportCallbacks {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export type RunReportResult =
  | { ok: true; agentRun: AgentRun; text: string }
  | { ok: false; agentRun: AgentRun; error: string };

const KIND_LABEL: Record<ReportKind, string> = { daily: '日报', weekly: '周报', monthly: '月报' };

function describeReportError(agentRun: AgentRun): string {
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
  return '这次没能写出来——多轮尝试都没收尾，再点一次试试';
}

/** 汇报官链路：跑一次 reporter run，outcome==='text' 才算成功（没有 outputContract），其余走友好错误文案 */
export async function runReport(
  kind: ReportKind,
  deps: RunReportDeps,
  callbacks: RunReportCallbacks = {},
): Promise<RunReportResult> {
  const profile = buildReporterProfile(deps.existingTasks, deps.context);
  const input = `写一份${KIND_LABEL[kind]}。`;

  const agentRun = await runAgent(
    profile,
    input,
    { registry: deps.registry, llm: deps.llm, defaultModel: deps.defaultModel },
    { onDelta: callbacks.onDelta, signal: callbacks.signal },
  );

  if (agentRun.outcome === 'text') {
    return { ok: true, agentRun, text: agentRun.finalText };
  }
  return { ok: false, agentRun, error: describeReportError(agentRun) };
}
