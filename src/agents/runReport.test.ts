import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useReportTemplateStore } from '@/src/store/reportTemplateStore';
import { createDefaultToolRegistry } from './registry';
import { runReport } from './runReport';
import type { LlmDriver, LlmDriverResult } from './harness/llmDriver';

function scriptedDriver(script: LlmDriverResult[]): LlmDriver {
  let i = 0;
  return async (_messages, _tools, _params, callbacks) => {
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    if (step.text) callbacks.onDelta?.(step.text);
    return step;
  };
}

describe('runReport', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useReportTemplateStore.setState({ template: null });
  });

  it('文本终局算成功，input 携带对应报告类型的中文名', async () => {
    let seenInput = '';
    const driver: LlmDriver = async (messages, _tools, _params, callbacks) => {
      seenInput = messages[messages.length - 1].content;
      callbacks.onDelta?.('日报内容');
      return { text: '日报内容', toolCalls: [] };
    };
    const result = await runReport('daily', {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result).toMatchObject({ ok: true, text: '日报内容' });
    expect(seenInput).toContain('日报');
  });

  it('周报/月报也能各自生成', async () => {
    for (const [kind, label] of [
      ['weekly', '周报'],
      ['monthly', '月报'],
    ] as const) {
      const driver = scriptedDriver([{ text: `${label}内容`, toolCalls: [] }]);
      const result = await runReport(kind, {
        registry: createDefaultToolRegistry(),
        llm: driver,
        defaultModel: 'mock',
        existingTasks: [],
      });
      expect(result).toMatchObject({ ok: true, text: `${label}内容` });
    }
  });

  it('工具调用（query_task_history）之后再收尾也能正常拿到文本', async () => {
    const driver = scriptedDriver([
      { text: '', toolCalls: [{ id: 'c1', name: 'query_task_history', args: { range: 'today' } }] },
      { text: '【今日完成】\n1. 写周报', toolCalls: [] },
    ]);
    const result = await runReport('daily', {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });
    expect(result).toMatchObject({ ok: true, text: '【今日完成】\n1. 写周报' });
  });

  it('401 等错误归为友好文案，ok=false', async () => {
    const { LlmError } = await import('@/src/llm/types');
    const driver: LlmDriver = async () => {
      throw new LlmError('unauthorized', 'key 不对', 401);
    };
    const result = await runReport('daily', {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });
    expect(result.ok).toBe(false);
  });
});
