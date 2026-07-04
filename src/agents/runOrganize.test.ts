import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { createDefaultToolRegistry } from './registry';
import { runOrganize } from './runOrganize';
import { LlmError } from '@/src/llm/types';
import type { LlmDriver, LlmDriverResult } from './harness/llmDriver';

function scriptedDriver(script: Array<LlmDriverResult | Error>): LlmDriver {
  let i = 0;
  return async (_messages, _tools, _params, callbacks) => {
    const step = script[i];
    i += 1;
    if (step instanceof Error) throw step;
    if (step.text) callbacks.onDelta?.(step.text);
    return step;
  };
}

describe('runOrganize', () => {
  let taskA: { id: string };
  let taskB: { id: string };

  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useRelationsStore.setState({ relations: [] });
    const created = useTasksStore.getState().addTasks([
      { title: '发布会 PPT：给经销商讲渠道政策', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
      { title: '发布会宣传文案，先出两版', type: 'write', fit: 'full', saveMin: 50, fragmentId: 'f1' },
    ]);
    [taskA, taskB] = created;
  });

  it('产出建议时落成 relationsStore 记录（真实 task id，不是 localId）', async () => {
    const llm = scriptedDriver([
      {
        text: JSON.stringify({
          suggestions: [
            { taskIds: [taskA.id, taskB.id], reason: '同一套信息', suggestion: '先定关键信息' },
          ],
        }),
        toolCalls: [],
      },
    ]);

    const result = await runOrganize(Object.values(useTasksStore.getState().tasks), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
    });

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].taskIds.sort()).toEqual([taskA.id, taskB.id].sort());
    expect(useRelationsStore.getState().relations).toHaveLength(1);
  });

  it('没有发现关联时不产生任何 relation', async () => {
    const llm = scriptedDriver([{ text: JSON.stringify({ suggestions: [] }), toolCalls: [] }]);
    const result = await runOrganize(Object.values(useTasksStore.getState().tasks), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
    });
    expect(result.relations).toEqual([]);
  });

  it('契约两次都校验失败时走 fallback（空建议），不产生关联也不抛异常', async () => {
    const llm = scriptedDriver([
      { text: '这不是 JSON', toolCalls: [] },
      { text: '还是不是 JSON', toolCalls: [] },
    ]);
    const result = await runOrganize(Object.values(useTasksStore.getState().tasks), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
    });
    expect(result.relations).toEqual([]);
    expect(result.agentRun.outcome).toBe('contract_fallback');
  });

  it('LLM 报错时不抛异常，relations 为空', async () => {
    const llm = scriptedDriver([new LlmError('network', '连不上')]);
    const result = await runOrganize(Object.values(useTasksStore.getState().tasks), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
    });
    expect(result.relations).toEqual([]);
  });
});
