/**
 * 对话 evals（arch §7）：脚本化多轮场景，断言应调的工具序列与终局要素。
 * 复用 T14 已经建好的真实 mock fixture（src/mocks/llm/fixtures.ts 的
 * orchestrator-meeting-done / orchestrator-ppt-howto / DEFAULT_FIXTURE）——
 * 这套 fixture 本来就是产品剧本的标注结果，evals 只是换个角度对它做断言。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useUiStore } from '@/src/store/uiStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { mockStreamChatCompletion } from '@/src/mocks/llm/mockTransport';
import { runChat } from '@/src/agents/runChat';

function chatDeps() {
  return {
    registry: createDefaultToolRegistry(),
    llm: createLlmDriver({ baseUrl: 'mock://', apiKey: 'mock' }, mockStreamChatCompletion),
    defaultModel: 'mock-model',
  };
}

describe('对话 evals（arch §7）：脚本化多轮场景断言工具序列与终局要素', () => {
  let meetingTaskId: string;
  let pptTaskId: string;

  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useUiStore.setState({ activeTab: 'overview', reveal: null, notification: null });

    const created = useTasksStore.getState().addTasks([
      { title: '整理今天的会议纪要，下班前发群里', type: 'write', fit: 'full', saveMin: 40, fragmentId: 'f1' },
      { title: '发布会 PPT：给经销商讲渠道政策', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
    ]);
    meetingTaskId = created[0].id;
    pptTaskId = created[1].id;
  });

  it('剧本①「会议纪要发完了」→ 调 complete_task(会议纪要真实id) → 终局文本提到"划掉"', async () => {
    const existingTasks = Object.values(useTasksStore.getState().tasks);
    const result = await runChat('会议纪要发完了', [], { ...chatDeps(), existingTasks });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('划掉');

    const toolCallNames = result.agentRun.turns.flatMap((turn) => turn.toolCalls.map((c) => c.name));
    expect(toolCallNames).toContain('complete_task');
    const completeCall = result.agentRun.turns.flatMap((t) => t.toolCalls).find((c) => c.name === 'complete_task');
    expect(completeCall?.args).toEqual({ id: meetingTaskId });
    expect(useTasksStore.getState().tasks[meetingTaskId].status).toBe('done');
  });

  it('剧本②「PPT 不知道从哪下手」→ 调 reveal_card(发布会PPT真实id) → 终局文本是分步教学', async () => {
    const existingTasks = Object.values(useTasksStore.getState().tasks);
    const result = await runChat('PPT 不知道从哪下手', [], { ...chatDeps(), existingTasks });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toMatch(/[①1]/); // 分步教学带序号

    const revealCall = result.agentRun.turns.flatMap((t) => t.toolCalls).find((c) => c.name === 'reveal_card');
    expect(revealCall?.args).toEqual({ taskId: pptTaskId });
    expect(useUiStore.getState().activeTab).toBe('jobs');
    expect(useUiStore.getState().reveal).toMatchObject({ taskId: pptTaskId });
  });

  it('剧本③ 胡乱输入 → 不调用任何工具，走友好兜底文案', async () => {
    const existingTasks = Object.values(useTasksStore.getState().tasks);
    const result = await runChat('啊我也不知道该说啥随便打点字', [], { ...chatDeps(), existingTasks });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const toolCallCount = result.agentRun.turns.flatMap((t) => t.toolCalls).length;
    expect(toolCallCount).toBe(0);
    expect(result.text.length).toBeGreaterThan(0);
  });
});
