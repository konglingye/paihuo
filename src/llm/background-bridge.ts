import { browser } from 'wxt/browser';
import { streamChatCompletion } from './transport';
import { LlmError, type StreamChatCompletion } from './types';
import { LLM_PORT_NAME, type LlmPortRequest, type LlmPortResponse, type PortLike } from './protocol';

/** 处理单个 port 连接上的 LLM 流式请求，按 requestId 支持并发/中断。纯逻辑，不依赖真实 chrome API，可单测。 */
export function handleLlmPort(port: PortLike, streamImpl: StreamChatCompletion = streamChatCompletion): void {
  const controllers = new Map<string, AbortController>();

  port.onMessage.addListener((raw) => {
    const message = raw as LlmPortRequest;

    if (message.type === 'start') {
      const controller = new AbortController();
      controllers.set(message.requestId, controller);

      streamImpl(
        message.params,
        {
          onDelta: (text) => {
            const response: LlmPortResponse = { type: 'delta', requestId: message.requestId, text };
            port.postMessage(response);
          },
          onUsage: (usage) => {
            const response: LlmPortResponse = { type: 'usage', requestId: message.requestId, usage };
            port.postMessage(response);
          },
        },
        controller.signal,
      )
        .then((result) => {
          const response: LlmPortResponse = { type: 'done', requestId: message.requestId, result };
          port.postMessage(response);
        })
        .catch((err) => {
          const llmError = err instanceof LlmError ? err : new LlmError('unknown', String(err));
          const response: LlmPortResponse = {
            type: 'error',
            requestId: message.requestId,
            error: { kind: llmError.kind, message: llmError.message, status: llmError.status },
          };
          port.postMessage(response);
        })
        .finally(() => controllers.delete(message.requestId));
    } else if (message.type === 'abort') {
      controllers.get(message.requestId)?.abort();
      controllers.delete(message.requestId);
    }
  });

  port.onDisconnect.addListener(() => {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
  });
}

/** 在 background service worker 里注册一次即可：真实网络请求只从这里发起，解 CORS（spec §2） */
export function registerLlmBackgroundBridge(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== LLM_PORT_NAME) return;
    handleLlmPort(port as unknown as PortLike);
  });
}
