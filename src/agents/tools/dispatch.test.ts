import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { ToolRegistry } from '../harness/tools';
import { createDispatchTool } from './dispatch';
import type { LlmDriver } from '../harness/llmDriver';

function scriptedLlm(script: Array<{ text: string; toolCalls?: { id: string; name: string; args: unknown }[] }>): LlmDriver {
  let i = 0;
  return async () => {
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    return { text: step.text, toolCalls: step.toolCalls ?? [] };
  };
}

describe('dispatch 工具', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
  });

  it('schema 只接受三个已知子代理，未知的直接报参数错误', () => {
    const registry = new ToolRegistry();
    const tool = createDispatchTool({ registry, llm: scriptedLlm([{ text: 'x' }]), defaultModel: 'mock' });
    expect(tool.paramsSchema.safeParse({ agent: 'ghost', input: 'x' }).success).toBe(false);
    expect(tool.paramsSchema.safeParse({ agent: 'decomposer', input: 'x' }).success).toBe(true);
  });

  it('委派给 organizer：同一 harness 递归跑一次，返回 outcome 与 finalOutput', async () => {
    const registry = new ToolRegistry();
    const llm = scriptedLlm([{ text: '{"suggestions":[]}' }]);
    const tool = createDispatchTool({ registry, llm, defaultModel: 'mock' });

    const result = (await tool.handler({ agent: 'organizer', input: '看看有没有能合并的' })) as {
      agent: string;
      outcome: string;
      finalOutput: unknown;
    };

    expect(result.agent).toBe('organizer');
    expect(result.outcome).toBe('contract');
    expect(result.finalOutput).toEqual({ suggestions: [] });
  });

  it('子代理的 profile 不带 dispatch 白名单——委派深度天然≤1，不会无限递归', async () => {
    const registry = new ToolRegistry();
    const tool = createDispatchTool({ registry, llm: scriptedLlm([{ text: '一段汇报文本' }]), defaultModel: 'mock' });

    const result = (await tool.handler({ agent: 'reporter', input: '写个日报' })) as { outcome: string; finalOutput: unknown };

    expect(result.outcome).toBe('text');
    expect(result.finalOutput).toBe('一段汇报文本');
  });

  it('effect 是 write（串行执行，避免并发发起多个嵌套 LLM 调用）', () => {
    const registry = new ToolRegistry();
    const tool = createDispatchTool({ registry, llm: scriptedLlm([{ text: 'x' }]), defaultModel: 'mock' });
    expect(tool.effect).toBe('write');
  });
});
