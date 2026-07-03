import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_TOOL_CALLS_PER_TURN,
  DEFAULT_MAX_TURNS,
  DEFAULT_TOKEN_BUDGET,
  estimateMessagesTokens,
  estimateTokens,
  isIdleTurn,
} from './budget';

describe('estimateTokens', () => {
  it('按 chars/1.6 启发式估算（中文场景写明是估算）', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('一二三四')).toBe(Math.ceil(4 / 1.6));
  });
});

describe('estimateMessagesTokens', () => {
  it('累加所有消息内容的估算 token 数', () => {
    const messages = [
      { role: 'user' as const, content: '你好' },
      { role: 'assistant' as const, content: '在的' },
    ];
    expect(estimateMessagesTokens(messages)).toBe(estimateTokens('你好') + estimateTokens('在的'));
  });

  it('工具调用的 arguments 也计入估算', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_task', arguments: '{"id":"abcdefg"}' }],
      },
    ];
    expect(estimateMessagesTokens(messages)).toBe(estimateTokens('{"id":"abcdefg"}'));
  });
});

describe('默认预算常量', () => {
  it('maxTurns 默认 6，每轮最大工具调用数默认 4，token 上限默认 32000', () => {
    expect(DEFAULT_MAX_TURNS).toBe(6);
    expect(DEFAULT_MAX_TOOL_CALLS_PER_TURN).toBe(4);
    expect(DEFAULT_TOKEN_BUDGET).toBe(32000);
  });
});

describe('isIdleTurn（空转检测）', () => {
  it('既没有文本也没有工具调用时视为空转', () => {
    expect(isIdleTurn({ text: '', toolCalls: [] }, undefined)).toBe(true);
  });

  it('有文本内容时不算空转', () => {
    expect(isIdleTurn({ text: '好的', toolCalls: [] }, undefined)).toBe(false);
  });

  it('和上一轮工具调用完全相同（同名同参）视为空转', () => {
    const prev = { text: '', toolCalls: [{ name: 'get_task', args: { id: '1' } }] };
    const curr = { text: '', toolCalls: [{ name: 'get_task', args: { id: '1' } }] };
    expect(isIdleTurn(curr, prev)).toBe(true);
  });

  it('工具调用参数不同则不算空转', () => {
    const prev = { text: '', toolCalls: [{ name: 'get_task', args: { id: '1' } }] };
    const curr = { text: '', toolCalls: [{ name: 'get_task', args: { id: '2' } }] };
    expect(isIdleTurn(curr, prev)).toBe(false);
  });
});
