import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runAgent } from './loop';
import { ToolRegistry } from './tools';
import type { ToolDefinition } from './tools';
import type { LlmDriver, LlmDriverResult } from './llmDriver';
import { LlmError } from '@/src/llm/types';

function scriptedDriver(script: Array<LlmDriverResult | Error>): { driver: LlmDriver; callCount: () => number } {
  let i = 0;
  const driver: LlmDriver = async (_messages, _tools, _params, callbacks) => {
    const step = script[i];
    i += 1;
    if (step instanceof Error) throw step;
    if (step.text) callbacks.onDelta?.(step.text);
    return step;
  };
  return { driver, callCount: () => i };
}

function baseProfile(overrides: Partial<Parameters<typeof runAgent>[0]> = {}) {
  return {
    name: 'test-profile',
    systemPrompt: '你是测试用的 profile',
    toolNames: ['echo'],
    ...overrides,
  };
}

const echoCalls: unknown[] = [];
const echoTool: ToolDefinition = {
  name: 'echo',
  description: '记录调用参数',
  paramsSchema: z.object({ text: z.string() }),
  effect: 'read',
  handler: (params) => {
    echoCalls.push(params);
    return params;
  },
};

function makeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(echoTool);
  return registry;
}

describe('runAgent', () => {
  it('第一轮就没有工具调用时直接文本终局', async () => {
    const { driver } = scriptedDriver([{ text: '你好，我是小派', toolCalls: [] }]);
    const run = await runAgent(baseProfile(), '随便聊聊', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' });

    expect(run.outcome).toBe('text');
    expect(run.finalText).toBe('你好，我是小派');
    expect(run.turns).toHaveLength(1);
  });

  it('多轮工具链：先调用工具拿结果，再据此给出文本终局', async () => {
    echoCalls.length = 0;
    const { driver } = scriptedDriver([
      { text: '', toolCalls: [{ id: 'c1', name: 'echo', args: { text: 'hi' } }] },
      { text: '工具告诉我 hi，所以我说：收到', toolCalls: [] },
    ]);
    const run = await runAgent(baseProfile(), '帮我处理一下', {
      registry: makeRegistry(),
      llm: driver,
      defaultModel: 'mock',
    });

    expect(echoCalls).toEqual([{ text: 'hi' }]);
    expect(run.outcome).toBe('text');
    expect(run.finalText).toBe('工具告诉我 hi，所以我说：收到');
    expect(run.turns).toHaveLength(2);
    expect(run.turns[0].toolCalls[0].name).toBe('echo');
    expect(run.turns[0].toolCalls[0].result.ok).toBe(true);
  });

  it('工具调用数超过每轮上限时被截断执行', async () => {
    echoCalls.length = 0;
    const { driver } = scriptedDriver([
      {
        text: '',
        toolCalls: [
          { id: 'c1', name: 'echo', args: { text: '1' } },
          { id: 'c2', name: 'echo', args: { text: '2' } },
          { id: 'c3', name: 'echo', args: { text: '3' } },
        ],
      },
      { text: '好了', toolCalls: [] },
    ]);
    const run = await runAgent(baseProfile({ maxToolCallsPerTurn: 2 }), 'x', {
      registry: makeRegistry(),
      llm: driver,
      defaultModel: 'mock',
    });

    expect(echoCalls).toHaveLength(2);
    expect(run.turns[0].toolCalls).toHaveLength(2);
  });

  it('超过 maxTurns 时兜底 bailout（模型一直要求调工具，从不收尾）', async () => {
    const infiniteScript = Array.from({ length: 10 }, (_, i) => ({
      text: '',
      toolCalls: [{ id: `c${i}`, name: 'echo', args: { text: `第${i}轮` } }],
    }));
    const { driver } = scriptedDriver(infiniteScript);
    const run = await runAgent(baseProfile({ maxTurns: 3 }), 'x', {
      registry: makeRegistry(),
      llm: driver,
      defaultModel: 'mock',
    });

    expect(run.outcome).toBe('bailout');
    expect(run.turns).toHaveLength(3);
  });

  it('连续两轮空转（工具调用完全重复）强制收尾，不等到 maxTurns', async () => {
    const { driver } = scriptedDriver([
      { text: '', toolCalls: [{ id: 'c1', name: 'echo', args: { text: 'same' } }] },
      { text: '', toolCalls: [{ id: 'c2', name: 'echo', args: { text: 'same' } }] },
      { text: '', toolCalls: [{ id: 'c3', name: 'echo', args: { text: 'same' } }] },
    ]);
    const run = await runAgent(baseProfile({ maxTurns: 10 }), 'x', {
      registry: makeRegistry(),
      llm: driver,
      defaultModel: 'mock',
    });

    expect(run.outcome).toBe('bailout');
    expect(run.turns.length).toBeLessThan(10);
  });

  describe('结构化输出契约', () => {
    const contractProfile = () =>
      baseProfile({
        outputContract: z.object({ tasks: z.array(z.string()) }),
      });

    it('第一次就通过校验', async () => {
      const { driver } = scriptedDriver([{ text: '{"tasks":["写周报"]}', toolCalls: [] }]);
      const run = await runAgent(contractProfile(), 'x', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' });

      expect(run.outcome).toBe('contract');
      expect(run.finalOutput).toEqual({ tasks: ['写周报'] });
      expect(run.turns).toHaveLength(1);
    });

    it('第一次校验失败，带错误重试一次后修复成功', async () => {
      const { driver, callCount } = scriptedDriver([
        { text: '这不是 JSON', toolCalls: [] },
        { text: '{"tasks":["写周报"]}', toolCalls: [] },
      ]);
      const run = await runAgent(contractProfile(), 'x', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' });

      expect(callCount()).toBe(2);
      expect(run.outcome).toBe('contract');
      expect(run.finalOutput).toEqual({ tasks: ['写周报'] });
      expect(run.turns).toHaveLength(2);
    });

    it('重试后仍失败且有 fallback 时走降级路径', async () => {
      const { driver } = scriptedDriver([
        { text: '还是不是 JSON', toolCalls: [] },
        { text: '仍然不是 JSON', toolCalls: [] },
      ]);
      const run = await runAgent(
        {
          ...contractProfile(),
          fallback: (raw) => ({ tasks: [], note: `待手动拆：${raw}` }),
        },
        'x',
        { registry: makeRegistry(), llm: driver, defaultModel: 'mock' },
      );

      expect(run.outcome).toBe('contract_fallback');
      expect(run.finalOutput).toEqual({ tasks: [], note: '待手动拆：仍然不是 JSON' });
    });

    it('重试后仍失败且没有 fallback 时归为 bailout', async () => {
      const { driver } = scriptedDriver([
        { text: '还是不是 JSON', toolCalls: [] },
        { text: '仍然不是 JSON', toolCalls: [] },
      ]);
      const run = await runAgent(contractProfile(), 'x', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' });

      expect(run.outcome).toBe('bailout');
    });
  });

  describe('中断', () => {
    it('signal 已经 aborted 时不发起任何 LLM 调用，直接返回 aborted', async () => {
      const { driver, callCount } = scriptedDriver([{ text: 'x', toolCalls: [] }]);
      const controller = new AbortController();
      controller.abort();

      const run = await runAgent(baseProfile(), 'x', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' }, { signal: controller.signal });

      expect(run.outcome).toBe('aborted');
      expect(callCount()).toBe(0);
    });
  });

  describe('错误分级', () => {
    it('429 会退避重试一次，重试成功后正常继续', async () => {
      const { driver, callCount } = scriptedDriver([
        new LlmError('rate_limited', '请求太快了', 429),
        { text: '好了', toolCalls: [] },
      ]);
      const run = await runAgent(baseProfile(), 'x', {
        registry: makeRegistry(),
        llm: driver,
        defaultModel: 'mock',
        retryDelayMs: 0,
      });

      expect(callCount()).toBe(2);
      expect(run.outcome).toBe('text');
      expect(run.finalText).toBe('好了');
    });

    it('401 不重试，直接结束为 error 并标注 kind', async () => {
      const { driver, callCount } = scriptedDriver([new LlmError('unauthorized', 'key 不对', 401)]);
      const run = await runAgent(baseProfile(), 'x', {
        registry: makeRegistry(),
        llm: driver,
        defaultModel: 'mock',
        retryDelayMs: 0,
      });

      expect(callCount()).toBe(1);
      expect(run.outcome).toBe('error');
      expect(run.error).toMatchObject({ kind: 'unauthorized' });
    });
  });

  describe('trace 完整性', () => {
    it('每轮记录 assistantText/toolCalls/usage/durationMs，run 记录 profile/输入摘要/起止时间', async () => {
      const { driver } = scriptedDriver([
        {
          text: '',
          toolCalls: [{ id: 'c1', name: 'echo', args: { text: 'hi' } }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        },
        { text: '完成', toolCalls: [] },
      ]);
      const run = await runAgent(baseProfile(), '倒个活儿', {
        registry: makeRegistry(),
        llm: driver,
        defaultModel: 'mock',
      });

      expect(run.profileName).toBe('test-profile');
      expect(run.inputSummary).toBe('倒个活儿');
      expect(run.startedAt).toBeTypeOf('number');
      expect(run.finishedAt).toBeGreaterThanOrEqual(run.startedAt);
      expect(run.turns[0]).toMatchObject({
        turn: 0,
        assistantText: '',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
      expect(run.turns[0].toolCalls[0]).toMatchObject({ name: 'echo', args: { text: 'hi' } });
      expect(run.turns[0].durationMs).toBeTypeOf('number');
    });
  });

  it('onDelta 回调会从 llm 驱动一路转发给调用方', async () => {
    const { driver } = scriptedDriver([{ text: '流式增量', toolCalls: [] }]);
    const deltas: string[] = [];
    await runAgent(
      baseProfile(),
      'x',
      { registry: makeRegistry(), llm: driver, defaultModel: 'mock' },
      { onDelta: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(['流式增量']);
  });

  describe('多轮对话续接（history）', () => {
    it('options.history 会续接在 system 之后、本轮 input 之前', async () => {
      let seenMessages: unknown[] = [];
      const driver: LlmDriver = async (messages) => {
        seenMessages = messages;
        return { text: '收到', toolCalls: [] };
      };
      await runAgent(
        baseProfile(),
        '第二句话',
        { registry: makeRegistry(), llm: driver, defaultModel: 'mock' },
        {
          history: [
            { role: 'user', content: '第一句话' },
            { role: 'assistant', content: '第一句的回复' },
          ],
        },
      );

      expect(seenMessages).toEqual([
        { role: 'system', content: '你是测试用的 profile' },
        { role: 'user', content: '第一句话' },
        { role: 'assistant', content: '第一句的回复' },
        { role: 'user', content: '第二句话' },
      ]);
    });

    it('不传 history 时行为和以前一样：只有 system + 本轮 input', async () => {
      let seenMessages: unknown[] = [];
      const driver: LlmDriver = async (messages) => {
        seenMessages = messages;
        return { text: '收到', toolCalls: [] };
      };
      await runAgent(baseProfile(), '只有一句话', { registry: makeRegistry(), llm: driver, defaultModel: 'mock' });

      expect(seenMessages).toEqual([
        { role: 'system', content: '你是测试用的 profile' },
        { role: 'user', content: '只有一句话' },
      ]);
    });
  });

  describe('onToolCall 活动回调', () => {
    it('执行工具前上抛这一批调用（活动指示用），文本终局轮不触发', async () => {
      const { driver } = scriptedDriver([
        { text: '', toolCalls: [{ id: 'c1', name: 'echo', args: { text: 'hi' } }] },
        { text: '好了', toolCalls: [] },
      ]);
      const calls: { name: string; args: unknown }[][] = [];
      await runAgent(
        baseProfile(),
        'x',
        { registry: makeRegistry(), llm: driver, defaultModel: 'mock' },
        { onToolCall: (batch) => calls.push(batch) },
      );

      expect(calls).toEqual([[{ name: 'echo', args: { text: 'hi' } }]]);
    });
  });
});
