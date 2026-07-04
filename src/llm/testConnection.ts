import { streamChatCompletion as defaultStreamChatCompletion } from './client';
import { LlmError, type StreamChatCompletion } from './types';

export type TestConnectionResult =
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; error: LlmError };

/** 「测试连接」：发一次 1-token 请求，量延迟，三态（成功/401/429/网络...）都归一化成 TestConnectionResult */
export async function testConnection(
  params: { baseUrl: string; apiKey: string; model: string },
  streamImpl: StreamChatCompletion = defaultStreamChatCompletion,
): Promise<TestConnectionResult> {
  const start = performance.now();
  try {
    await streamImpl(
      { ...params, messages: [{ role: 'user', content: '你好' }], maxTokens: 1 },
      {},
    );
    return { ok: true, model: params.model, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    const error = err instanceof LlmError ? err : new LlmError('unknown', String(err));
    return { ok: false, error };
  }
}
