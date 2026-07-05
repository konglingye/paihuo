import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useTraceStore } from '@/src/store/traceStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { runDecompose } from '@/src/agents/runDecompose';
import { materializeDecomposerOutput, type MaterializeResult } from '@/src/agents/materializeDecomposerOutput';
import { eventBus } from '@/src/agents/events';
import type { DecomposerOutput } from '@/src/agents/profiles/decomposer';
import type { Fragment } from '@/src/store/schema';

export type DecomposePhase = 'idle' | 'reading' | 'drafting' | 'confirming' | 'done' | 'error';

export interface UseDecomposeRunResult {
  phase: DecomposePhase;
  error: string | null;
  /** 'confirming' 阶段待用户过一遍再入库的契约输出，其余阶段是 null */
  pendingOutput: DecomposerOutput | null;
  run: (fragment: Fragment) => Promise<void>;
  /** 用户在确认弹窗里点了"确认创建"——这里才真正落库，filledOutput 是补完/去掉截止时间之后的版本 */
  confirm: (filledOutput: DecomposerOutput) => MaterializeResult;
  /** 用户点了"取消"——契约输出直接丢弃，不落库 */
  cancel: () => void;
}

/**
 * 倒活→拆解的钩子：思考态两段文案由 loop 的真实流式事件驱动——
 * 第一段"正在读你贴的内容…"在发起请求时就显示，第二段"正在拆解成任务…"
 * 在模型真正吐出第一个文本增量时才切换（不是定时器假装）。
 *
 * 拆解完不直接落库：用户要求先弹确认弹窗过一遍（尤其是截止时间要么确认要么手动补），
 * 所以 run() 结束后进入 'confirming' 阶段，真正落库要等 confirm() 被调用。
 */
export function useDecomposeRun(): UseDecomposeRunResult {
  const [phase, setPhase] = useState<DecomposePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOutput, setPendingOutput] = useState<DecomposerOutput | null>(null);
  const [pendingFragmentId, setPendingFragmentId] = useState<string | null>(null);
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
        setPendingOutput(result.output);
        setPendingFragmentId(result.fragmentId);
        setPhase('confirming');
      } else {
        setError(result.error);
        setPhase('error');
      }
    },
    [settings],
  );

  const confirm = useCallback(
    (filledOutput: DecomposerOutput): MaterializeResult => {
      const fragmentId = pendingFragmentId ?? '';
      const materialized = materializeDecomposerOutput(filledOutput, fragmentId);
      setPendingOutput(null);
      setPendingFragmentId(null);
      setPhase('done');
      // dump.created 事件（arch §5）：真正落库后才跑一次整理官找关联，不用手动点"找关联"
      void eventBus.emit({ type: 'dump.created', fragmentId });
      return materialized;
    },
    [pendingFragmentId],
  );

  const cancel = useCallback(() => {
    setPendingOutput(null);
    setPendingFragmentId(null);
    setPhase('idle');
  }, []);

  return { phase, error, pendingOutput, run, confirm, cancel };
}
