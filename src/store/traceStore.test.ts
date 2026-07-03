import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTraceStore } from './traceStore';
import type { AgentRun } from '@/src/agents/harness/trace';

function makeRun(id: string, startedAt: number): AgentRun {
  return {
    id,
    profileName: 'decomposer',
    inputSummary: 'x',
    turns: [],
    outcome: 'text',
    finalText: 'ok',
    startedAt,
    finishedAt: startedAt + 10,
  };
}

describe('traceStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTraceStore.setState({ runs: [] });
  });

  it('初始为空', () => {
    expect(useTraceStore.getState().runs).toEqual([]);
  });

  it('addRun 把新 run 放在最前面', () => {
    useTraceStore.getState().addRun(makeRun('r1', 1));
    useTraceStore.getState().addRun(makeRun('r2', 2));
    expect(useTraceStore.getState().runs.map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('环形保留最近 100 条，超出的旧记录被淘汰', () => {
    for (let i = 0; i < 105; i++) {
      useTraceStore.getState().addRun(makeRun(`r${i}`, i));
    }
    const runs = useTraceStore.getState().runs;
    expect(runs).toHaveLength(100);
    expect(runs[0].id).toBe('r104');
    expect(runs[runs.length - 1].id).toBe('r5');
  });

  it('clearRuns 清空记录', () => {
    useTraceStore.getState().addRun(makeRun('r1', 1));
    useTraceStore.getState().clearRuns();
    expect(useTraceStore.getState().runs).toEqual([]);
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:trace': JSON.stringify({ state: { runs: [makeRun('r1', 1)] }, version: 1 }),
    });
    await useTraceStore.persist.rehydrate();
    expect(useTraceStore.getState().runs).toHaveLength(1);
    expect(useTraceStore.getState().runs[0].id).toBe('r1');
  });
});
