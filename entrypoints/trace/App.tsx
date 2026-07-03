import { useState } from 'react';
import { useTasksStore, useTraceStore } from '@/src/store';
import { runAgent } from '@/src/agents/harness/loop';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { mockStreamChatCompletion } from '@/src/mocks/llm/mockTransport';
import { buildDecomposerProfile } from '@/src/agents/profiles/decomposer';
import { DECOMPOSER_SAMPLE_INPUT } from '@/src/mocks/llm/fixtures';
import type { AgentRun, AgentRunOutcome } from '@/src/agents/harness/trace';

const OUTCOME_STYLE: Record<AgentRunOutcome, string> = {
  text: 'bg-gray-soft text-gray-ink',
  contract: 'bg-ok-soft text-ok',
  contract_fallback: 'bg-accent-soft text-accent-ink',
  bailout: 'bg-red-soft text-red',
  error: 'bg-red-soft text-red',
  aborted: 'bg-gray-soft text-gray-ink',
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('zh-CN', { hour12: false });
}

function RunTurnDetail({ run }: { run: AgentRun }) {
  return (
    <div className="space-y-3 border-t border-hairsoft p-4">
      {run.turns.map((turn) => (
        <div key={turn.turn} className="rounded-lg border border-hairsoft bg-white p-3 text-[12.5px]">
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink">
            <span>第 {turn.turn} 轮</span>
            <span className="font-normal text-faint">{turn.durationMs}ms</span>
            {turn.usage && (
              <span className="font-normal text-faint">
                usage: {turn.usage.promptTokens}+{turn.usage.completionTokens}={turn.usage.totalTokens}
              </span>
            )}
          </div>
          {turn.assistantText && <p className="mb-2 whitespace-pre-wrap text-sub">{turn.assistantText}</p>}
          {turn.toolCalls.map((call, i) => (
            <div key={i} className="mb-1.5 rounded-md bg-wash p-2">
              <div className="font-semibold text-accent-ink">{call.name}</div>
              <div className="text-faint">args: {JSON.stringify(call.args)}</div>
              <div className={call.result.ok ? 'text-ok' : 'text-red'}>
                {call.result.ok ? `ok: ${JSON.stringify(call.result.result)}` : `error(${call.result.error.code}): ${call.result.error.message}`}
              </div>
            </div>
          ))}
        </div>
      ))}
      {run.finalOutput !== undefined && (
        <div className="rounded-lg border border-hairsoft bg-white p-3 text-[12.5px]">
          <div className="mb-1 font-semibold text-ink">finalOutput</div>
          <pre className="whitespace-pre-wrap break-all text-sub">{JSON.stringify(run.finalOutput, null, 2)}</pre>
        </div>
      )}
      {run.error && (
        <div className="rounded-lg border border-red-soft bg-red-soft p-3 text-[12.5px] text-red">
          error({run.error.kind}): {run.error.message}
        </div>
      )}
    </div>
  );
}

function App() {
  const runs = useTraceStore((s) => s.runs);
  const addRun = useTraceStore((s) => s.addRun);
  const tasks = useTasksStore((s) => s.tasks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function runDecomposerOnce() {
    setRunning(true);
    try {
      const registry = createDefaultToolRegistry();
      const profile = buildDecomposerProfile(Object.values(tasks));
      const driver = createLlmDriver({ baseUrl: 'mock://', apiKey: 'mock' }, mockStreamChatCompletion);
      const run = await runAgent(profile, DECOMPOSER_SAMPLE_INPUT, {
        registry,
        llm: driver,
        defaultModel: 'mock-model',
      });
      addRun(run);
      setExpandedId(run.id);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-ink">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold">#/trace（dev only）</h1>
        <button
          type="button"
          disabled={running}
          onClick={runDecomposerOnce}
          className="btn-gradient rounded-btn px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {running ? '跑中…' : '跑一次 decomposer（mock）'}
        </button>
      </div>

      {runs.length === 0 && <p className="text-sub">还没有任何 run，点右上角按钮跑一次看看。</p>}

      <div className="space-y-2">
        {runs.map((run) => {
          const expanded = expandedId === run.id;
          return (
            <div key={run.id} className="rounded-card border border-hairsoft bg-white shadow-card">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : run.id)}
                className="flex w-full items-center gap-3 p-3 text-left text-[13px]"
              >
                <span className="font-semibold">{run.profileName}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${OUTCOME_STYLE[run.outcome]}`}>
                  {run.outcome}
                </span>
                <span className="text-faint">{run.turns.length} 轮</span>
                <span className="ml-auto text-faint">{formatTime(run.startedAt)}</span>
              </button>
              {expanded && <RunTurnDetail run={run} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
