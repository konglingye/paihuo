import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useUiStore } from '@/src/store/uiStore';
import { createDefaultToolRegistry } from './registry';
import { runChat } from './runChat';
import type { ChatMessage } from '@/src/llm/types';
import type { LlmDriver, LlmDriverResult } from './harness/llmDriver';

function scriptedDriver(script: LlmDriverResult[]): { driver: LlmDriver; seenMessages: ChatMessage[][] } {
  let i = 0;
  const seenMessages: ChatMessage[][] = [];
  const driver: LlmDriver = async (messages, _tools, _params, callbacks) => {
    seenMessages.push(messages);
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    if (step.text) callbacks.onDelta?.(step.text);
    return step;
  };
  return { driver, seenMessages };
}

describe('runChat', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useUiStore.setState({ activeTab: 'overview', reveal: null, notification: null });
  });

  it('没有 history 时只有 system + 本轮 input，文本终局算成功', async () => {
    const { driver, seenMessages } = scriptedDriver([{ text: '收到', toolCalls: [] }]);
    const result = await runChat('随便聊聊', [], {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result).toMatchObject({ ok: true, text: '收到' });
    expect(seenMessages[0]).toHaveLength(2);
    expect(seenMessages[0][1]).toEqual({ role: 'user', content: '随便聊聊' });
  });

  it('传入 history 会续接在本轮 input 之前', async () => {
    const { driver, seenMessages } = scriptedDriver([{ text: '还记得', toolCalls: [] }]);
    const history: ChatMessage[] = [
      { role: 'user', content: '我姓李' },
      { role: 'assistant', content: '记住了，李哥' },
    ];
    await runChat('我姓什么来着', history, {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(seenMessages[0]).toHaveLength(4);
    expect(seenMessages[0][1]).toEqual(history[0]);
    expect(seenMessages[0][2]).toEqual(history[1]);
  });

  it('ui 工具（reveal_card）在聊天场景里真的会执行，不会被当成"没有用户手势"拒绝', async () => {
    const task = useTasksStore.getState().addTasks([
      { title: '发布会 PPT', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
    ])[0];

    const { driver } = scriptedDriver([
      { text: '', toolCalls: [{ id: 'c1', name: 'reveal_card', args: { taskId: task.id } }] },
      { text: '带你去看看那张卡', toolCalls: [] },
    ]);

    const result = await runChat('PPT 怎么开始', [], {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [task],
    });

    expect(result.agentRun.turns[0].toolCalls[0].result).toMatchObject({ ok: true });
    expect(useUiStore.getState().activeTab).toBe('jobs');
    expect(useUiStore.getState().reveal).toMatchObject({ taskId: task.id });
  });

  it('onDelta/onToolCall 回调会转发给调用方', async () => {
    const { driver } = scriptedDriver([
      { text: '', toolCalls: [{ id: 'c1', name: 'list_tasks', args: {} }] },
      { text: '看完了', toolCalls: [] },
    ]);
    const deltas: string[] = [];
    const toolCallBatches: { name: string; args: unknown }[][] = [];

    await runChat(
      '手里有啥活儿',
      [],
      { registry: createDefaultToolRegistry(), llm: driver, defaultModel: 'mock', existingTasks: [] },
      { onDelta: (d) => deltas.push(d), onToolCall: (batch) => toolCallBatches.push(batch) },
    );

    expect(deltas).toEqual(['看完了']);
    expect(toolCallBatches).toEqual([[{ name: 'list_tasks', args: {} }]]);
  });

  it('401 不重试，直接归为友好错误文案，ok=false', async () => {
    const { LlmError } = await import('@/src/llm/types');
    const driver: LlmDriver = async () => {
      throw new LlmError('unauthorized', 'key 不对', 401);
    };
    const result = await runChat('随便聊聊', [], {
      registry: createDefaultToolRegistry(),
      llm: driver,
      defaultModel: 'mock',
      existingTasks: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('key 不对');
  });
});
