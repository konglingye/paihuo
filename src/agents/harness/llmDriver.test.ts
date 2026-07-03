import { describe, expect, it } from 'vitest';
import { createLlmDriver } from './llmDriver';
import type { StreamChatCompletion } from '@/src/llm/types';

describe('createLlmDriver', () => {
  it('把 settings/params/messages/tools 透传给底层 stream 实现，并转换返回结果', async () => {
    let capturedParams: unknown;
    const stubStream: StreamChatCompletion = async (params, callbacks) => {
      capturedParams = params;
      callbacks.onDelta?.('你好');
      return { content: '你好', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
    };
    const driver = createLlmDriver({ baseUrl: 'https://api.deepseek.com', apiKey: 'sk-x' }, stubStream);

    const deltas: string[] = [];
    const result = await driver(
      [{ role: 'user', content: 'hi' }],
      [{ name: 'get_task', description: 'x', parameters: {} }],
      { model: 'deepseek-chat', temperature: 0.3 },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(capturedParams).toMatchObject({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-x',
      model: 'deepseek-chat',
      temperature: 0.3,
    });
    expect(deltas).toEqual(['你好']);
    expect(result).toEqual({ text: '你好', toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });
  });

  it('把工具调用的 arguments JSON 字符串解析成结构化 args', async () => {
    const stubStream: StreamChatCompletion = async () => ({
      content: '',
      toolCalls: [{ id: 'c1', name: 'get_task', arguments: '{"id":"t1"}' }],
    });
    const driver = createLlmDriver({ baseUrl: 'x', apiKey: 'x' }, stubStream);

    const result = await driver([], [], { model: 'x' }, {});
    expect(result.toolCalls).toEqual([{ id: 'c1', name: 'get_task', args: { id: 't1' } }]);
  });

  it('arguments 不是合法 JSON 时优雅降级，不抛异常', async () => {
    const stubStream: StreamChatCompletion = async () => ({
      content: '',
      toolCalls: [{ id: 'c1', name: 'get_task', arguments: '{不是json' }],
    });
    const driver = createLlmDriver({ baseUrl: 'x', apiKey: 'x' }, stubStream);

    const result = await driver([], [], { model: 'x' }, {});
    expect(result.toolCalls).toEqual([
      { id: 'c1', name: 'get_task', args: { __parse_error: true, raw: '{不是json' } },
    ]);
  });
});
