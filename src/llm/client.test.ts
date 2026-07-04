import { describe, expect, it, vi, afterEach } from 'vitest';

describe('streamChatCompletion（统一入口）', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('VITE_PAIHUO_MOCK=1 时走 mock 通道', async () => {
    vi.stubEnv('VITE_PAIHUO_MOCK', '1');
    const { streamChatCompletion } = await import('./client');
    const { DEFAULT_FIXTURE } = await import('@/src/mocks/llm/fixtures');

    const deltas: string[] = [];
    const result = await streamChatCompletion(
      { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: '随便说点什么' }] },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(result.content).toBe(DEFAULT_FIXTURE.chunks!.join(''));
  });

  it('非 mock 模式走真实通道（经 background port）', async () => {
    vi.stubEnv('VITE_PAIHUO_MOCK', '0');
    const { streamChatCompletion } = await import('./client');

    // 未连接真实 chrome runtime，real 通道应该报错而不是静默走 mock fixture
    await expect(
      streamChatCompletion({ baseUrl: 'x', apiKey: 'x', model: 'x', messages: [] }, {}),
    ).rejects.toThrow();
  });
});
