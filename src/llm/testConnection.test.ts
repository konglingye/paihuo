import { describe, expect, it } from 'vitest';
import { testConnection } from './testConnection';
import { LlmError, type StreamChatCompletion } from './types';

const params = { baseUrl: 'https://api.deepseek.com', apiKey: 'sk-test', model: 'deepseek-chat' };

describe('testConnection', () => {
  it('成功时返回 ok=true、model、latencyMs，且只带 1 个 token 的请求', async () => {
    let capturedMaxTokens: number | undefined;
    const stubStream: StreamChatCompletion = async (streamParams) => {
      capturedMaxTokens = streamParams.maxTokens;
      return { content: '你好' };
    };
    const result = await testConnection(params, stubStream);

    expect(result).toMatchObject({ ok: true, model: 'deepseek-chat' });
    if (result.ok) expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(capturedMaxTokens).toBe(1);
  });

  it('401 时返回 ok=false、kind=unauthorized', async () => {
    const stubStream: StreamChatCompletion = async () => {
      throw new LlmError('unauthorized', 'key 不对', 401);
    };
    const result = await testConnection(params, stubStream);
    expect(result).toMatchObject({ ok: false, error: { kind: 'unauthorized' } });
  });

  it('429 时返回 ok=false、kind=rate_limited', async () => {
    const stubStream: StreamChatCompletion = async () => {
      throw new LlmError('rate_limited', '太快了', 429);
    };
    const result = await testConnection(params, stubStream);
    expect(result).toMatchObject({ ok: false, error: { kind: 'rate_limited' } });
  });

  it('网络错误时返回 ok=false、kind=network', async () => {
    const stubStream: StreamChatCompletion = async () => {
      throw new LlmError('network', '连不上');
    };
    const result = await testConnection(params, stubStream);
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});
