import { describe, expect, it } from 'vitest';
import { handleLlmPort } from './background-bridge';
import { createRealStreamChatCompletion } from './realTransport';
import { LlmError, type StreamChatCompletion } from './types';
import type { PortLike } from './protocol';

/** 内存里对接的一对假 port，模拟 chrome.runtime.Port 的语义（自己 disconnect() 不会触发自己的 onDisconnect） */
function createFakePortPair(): { clientPort: PortLike; backgroundPort: PortLike } {
  const clientListeners: ((msg: unknown) => void)[] = [];
  const backgroundListeners: ((msg: unknown) => void)[] = [];
  const clientDisconnectListeners: (() => void)[] = [];
  const backgroundDisconnectListeners: (() => void)[] = [];
  let clientDisconnected = false;
  let backgroundDisconnected = false;

  const clientPort: PortLike = {
    postMessage: (msg) => {
      if (!backgroundDisconnected) backgroundListeners.forEach((cb) => cb(msg));
    },
    onMessage: { addListener: (cb) => clientListeners.push(cb) },
    onDisconnect: { addListener: (cb) => clientDisconnectListeners.push(cb) },
    disconnect: () => {
      if (clientDisconnected) return;
      clientDisconnected = true;
      backgroundDisconnectListeners.forEach((cb) => cb());
    },
  };
  const backgroundPort: PortLike = {
    postMessage: (msg) => {
      if (!clientDisconnected) clientListeners.forEach((cb) => cb(msg));
    },
    onMessage: { addListener: (cb) => backgroundListeners.push(cb) },
    onDisconnect: { addListener: (cb) => backgroundDisconnectListeners.push(cb) },
    disconnect: () => {
      if (backgroundDisconnected) return;
      backgroundDisconnected = true;
      clientDisconnectListeners.forEach((cb) => cb());
    },
  };
  return { clientPort, backgroundPort };
}

/** 每次调用都开一条新的假连接，background 侧自动挂上 handleLlmPort——对应生产环境每次 connect() 都是新 port */
function createConnectedClient(streamImpl: StreamChatCompletion): StreamChatCompletion {
  return createRealStreamChatCompletion(() => {
    const { clientPort, backgroundPort } = createFakePortPair();
    handleLlmPort(backgroundPort, streamImpl);
    return clientPort;
  });
}

describe('LLM background 代发桥（port 协议端到端）', () => {
  it('start → 逐片 delta/usage → done，client 收到完整结果', async () => {
    const stubStream: StreamChatCompletion = async (_params, callbacks) => {
      callbacks.onDelta?.('你');
      callbacks.onDelta?.('好');
      callbacks.onUsage?.({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
      return { content: '你好', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } };
    };
    const streamChatCompletion = createConnectedClient(stubStream);

    const deltas: string[] = [];
    let usage;
    const result = await streamChatCompletion(
      { baseUrl: 'x', apiKey: 'x', model: 'x', messages: [] },
      { onDelta: (d) => deltas.push(d), onUsage: (u) => (usage = u) },
    );

    expect(deltas).toEqual(['你', '好']);
    expect(result.content).toBe('你好');
    expect(usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
  });

  it('background 侧抛 LlmError 时，client 收到同样分类的错误', async () => {
    const stubStream: StreamChatCompletion = async () => {
      throw new LlmError('unauthorized', 'bad key', 401);
    };
    const streamChatCompletion = createConnectedClient(stubStream);

    await expect(
      streamChatCompletion({ baseUrl: 'x', apiKey: 'x', model: 'x', messages: [] }, {}),
    ).rejects.toMatchObject({ kind: 'unauthorized', status: 401, message: 'bad key' });
  });

  it('client abort() 后，background 侧收到的 AbortSignal 会被触发', async () => {
    let signalSeenAborted = false;
    const stubStream: StreamChatCompletion = (_params, _callbacks, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          signalSeenAborted = true;
          reject(new LlmError('aborted', '已取消'));
        });
      });
    const streamChatCompletion = createConnectedClient(stubStream);

    const controller = new AbortController();
    const promise = streamChatCompletion(
      { baseUrl: 'x', apiKey: 'x', model: 'x', messages: [] },
      {},
      controller.signal,
    );
    controller.abort();

    await expect(promise).rejects.toMatchObject({ kind: 'aborted' });
    expect(signalSeenAborted).toBe(true);
  });

  it('并发的多个请求各走各的 port，互不串号', async () => {
    const stubStream: StreamChatCompletion = async (params) => ({ content: `echo:${params.model}` });
    const streamChatCompletion = createConnectedClient(stubStream);

    const [r1, r2] = await Promise.all([
      streamChatCompletion({ baseUrl: 'x', apiKey: 'x', model: 'a', messages: [] }, {}),
      streamChatCompletion({ baseUrl: 'x', apiKey: 'x', model: 'b', messages: [] }, {}),
    ]);

    expect(r1.content).toBe('echo:a');
    expect(r2.content).toBe('echo:b');
  });
});
