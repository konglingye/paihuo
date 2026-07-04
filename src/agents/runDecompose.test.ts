import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import { createDefaultToolRegistry } from './registry';
import { runDecompose } from './runDecompose';
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

const VALID_OUTPUT = JSON.stringify({
  tasks: [
    { localId: 'n1', title: '整理会议纪要', type: 'write', fit: 'full', saveMin: 40 },
    { localId: 'n2', title: '发布会 PPT', type: 'slide', fit: 'assist', saveMin: 90 },
  ],
  groups: [],
  relates: [],
});

describe('runDecompose', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useGroupsStore.setState({ groups: {} });
    const fragment = useFragmentsStore.getState().addFragment({ raw: '倒点活儿' });
    useFragmentsStore.setState({ fragments: { [fragment.id]: fragment } });
  });

  function getFragment() {
    return Object.values(useFragmentsStore.getState().fragments)[0];
  }

  it('契约校验一次通过：产出任务并落库', async () => {
    const llm = scriptedDriver([{ text: VALID_OUTPUT, toolCalls: [] }]);
    const result = await runDecompose(getFragment(), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.materialized.tasks).toHaveLength(2);
      expect(result.agentRun.outcome).toBe('contract');
    }
    expect(Object.keys(useTasksStore.getState().tasks)).toHaveLength(2);
  });

  it('契约校验两次都失败：走降级路径，产出「待手动拆」卡（DoD 单测项）', async () => {
    const llm = scriptedDriver([
      { text: '这不是 JSON', toolCalls: [] },
      { text: '仍然不是 JSON', toolCalls: [] },
    ]);
    const result = await runDecompose(getFragment(), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.agentRun.outcome).toBe('contract_fallback');
      expect(result.materialized.tasks).toHaveLength(1);
      expect(result.materialized.tasks[0]).toMatchObject({ fit: 'self', type: 'misc' });
      expect(result.materialized.tasks[0].title).toContain('待手动拆');
    }
    expect(Object.keys(useTasksStore.getState().tasks)).toHaveLength(1);
  });

  it('LLM 报 401：不落任何任务，返回引导去设置页的错误文案', async () => {
    const llm = scriptedDriver([new LlmError('unauthorized', 'key 不对', 401)]);
    const result = await runDecompose(getFragment(), {
      registry: createDefaultToolRegistry(),
      llm,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('设置');
    expect(Object.keys(useTasksStore.getState().tasks)).toHaveLength(0);
  });

  it('onDelta 回调会转发出去（用于驱动思考态两段文案切换）', async () => {
    const llm = scriptedDriver([{ text: VALID_OUTPUT, toolCalls: [] }]);
    const deltas: string[] = [];
    await runDecompose(
      getFragment(),
      { registry: createDefaultToolRegistry(), llm, defaultModel: 'mock', existingTasks: [] },
      { onDelta: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual([VALID_OUTPUT]);
  });
});
