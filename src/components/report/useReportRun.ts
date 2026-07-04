import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useTraceStore } from '@/src/store/traceStore';
import { useReportsStore } from '@/src/store/reportsStore';
import { useReportTemplateStore } from '@/src/store/reportTemplateStore';
import { useWorklogStore } from '@/src/store/worklogStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { runReport } from '@/src/agents/runReport';
import type { ReportKind } from '@/src/store/schema';

/** 最近几条工作日志足够给汇报官参考趋势，不用把 90 天全塞进去（检索优先于灌注） */
const RECENT_WORKLOG_ENTRIES = 7;

export interface UseReportRunResult {
  text: string;
  busy: boolean;
  error: string | null;
  generate: (kind: ReportKind) => Promise<void>;
}

/** 汇报 tab 的核心钩子：流式拼接输出、成功后落 ReportRecord，模板名字从 reportTemplateStore 现取 */
export function useReportRun(): UseReportRunResult {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = useSettingsStore((s) => s.settings);

  const generate = useCallback(
    async (kind: ReportKind) => {
      setBusy(true);
      setError(null);
      setText('');

      const registry = createDefaultToolRegistry();
      const llm = createLlmDriver({ baseUrl: settings.baseUrl, apiKey: settings.apiKey });
      const existingTasks = Object.values(useTasksStore.getState().tasks);
      const template = useReportTemplateStore.getState().template;
      const worklogEntries = useWorklogStore.getState().entries.slice(-RECENT_WORKLOG_ENTRIES);

      const result = await runReport(
        kind,
        {
          registry,
          llm,
          defaultModel: settings.model,
          existingTasks,
          context: {
            worklogEntries,
            userName: settings.userName,
            org: settings.org,
            templateName: template?.name,
          },
        },
        { onDelta: (delta) => setText((prev) => prev + delta) },
      );

      useTraceStore.getState().addRun(result.agentRun);

      if (result.ok) {
        useReportsStore.getState().addReport({ kind, content: result.text });
        setText(result.text);
      } else {
        setError(result.error);
      }
      setBusy(false);
    },
    [settings],
  );

  return { text, busy, error, generate };
}
