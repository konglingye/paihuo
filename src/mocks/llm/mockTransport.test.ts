import { describe, expect, it } from 'vitest';
import { mockStreamChatCompletion } from './mockTransport';
import { DEFAULT_FIXTURE, FIXTURES } from './fixtures';

describe('mockStreamChatCompletion', () => {
  it('没有 fixture 命中时用 DEFAULT_FIXTURE，逐片调用 onDelta 并拼出完整内容', async () => {
    const deltas: string[] = [];
    const result = await mockStreamChatCompletion(
      { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: '随便说点什么' }] },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas).toEqual(DEFAULT_FIXTURE.chunks);
    expect(result.content).toBe(DEFAULT_FIXTURE.chunks.join(''));
    expect(result.usage).toEqual(DEFAULT_FIXTURE.usage);
  });

  it('按最后一条用户消息匹配到对应 fixture', async () => {
    const fixture = FIXTURES[0];
    const deltas: string[] = [];
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [
          { role: 'assistant', content: '在' },
          { role: 'user', content: '会议纪要发完了' },
        ],
      },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas).toEqual(fixture.chunks);
    expect(result.content).toBe(fixture.chunks.join(''));
  });

  it('外部 signal 已 abort 时立即抛出 aborted 错误', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      mockStreamChatCompletion(
        { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: 'hi' }] },
        {},
        controller.signal,
      ),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('流式中途 abort 会停止后续分片投递', async () => {
    const controller = new AbortController();
    const deltas: string[] = [];
    const promise = mockStreamChatCompletion(
      { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: '随便说点什么' }] },
      {
        onDelta: (d) => {
          deltas.push(d);
          if (deltas.length === 1) controller.abort();
        },
      },
      controller.signal,
    );

    await expect(promise).rejects.toMatchObject({ kind: 'aborted' });
    expect(deltas.length).toBeLessThan(DEFAULT_FIXTURE.chunks.length);
  });
});
