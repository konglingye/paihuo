import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useTraceStore } from '@/src/store/traceStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { runDecompose } from '@/src/agents/runDecompose';
import type { Fragment } from '@/src/store/schema';

export type DecomposePhase = 'idle' | 'reading' | 'drafting' | 'done' | 'error';

export interface UseDecomposeRunResult {
  phase: DecomposePhase;
  error: string | null;
  run: (fragment: Fragment) => Promise<void>;
}

/**
 * 倒活→拆解的钩子：思考态两段文案由 loop 的真实流式事件驱动——
 * 第一段"正在读你贴的内容…"在发起请求时就显示，第二段"正在拆解成任务…"
 * 在模型真正吐出第一个文本增量时才切换（不是定时器假装）。
 */
export function useDecomposeRun(): UseDecomposeRunResult {
  const [phase, setPhase] = useState<DecomposePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const settings = useSettingsStore((s) => s.settings);

  const run = useCallback(
    async (fragment: Fragment) => {
      setPhase('reading');
      setError(null);

      const registry = createDefaultToolRegistry();
      const llm = createLlmDriver({ baseUrl: settings.baseUrl, apiKey: settings.apiKey });
      const existingTasks = Object.values(useTasksStore.getState().tasks);

      const result = await runDecompose(
        fragment,
        { registry, llm, defaultModel: settings.model, existingTasks },
        { onDelta: () => setPhase((p) => (p === 'reading' ? 'drafting' : p)) },
      );

      useTraceStore.getState().addRun(result.agentRun);

      if (result.ok) {
        setPhase('done');
      } else {
        setError(result.error);
        setPhase('error');
      }
    },
    [settings],
  );

  return { phase, error, run };
}
