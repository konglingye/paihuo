import { browser } from 'wxt/browser';
import { LlmError, type StreamChatCompletion } from './types';
import { LLM_PORT_NAME, type LlmPortRequest, type LlmPortResponse, type PortLike } from './protocol';

type ConnectFn = () => PortLike;

const defaultConnect: ConnectFn = () =>
  browser.runtime.connect({ name: LLM_PORT_NAME }) as unknown as PortLike;

/** 真实通道的调用端：每次调用开一个新 port 转发给 background（见 background-bridge.ts） */
export function createRealStreamChatCompletion(connect: ConnectFn = defaultConnect): StreamChatCompletion {
  return (params, callbacks, signal) =>
    new Promise((resolve, reject) => {
      const port = connect();
      const requestId = crypto.randomUUID();
      let settled = false;

      const onAbort = () => {
        const request: LlmPortRequest = { type: 'abort', requestId };
        port.postMessage(request);
      };
      signal?.addEventListener('abort', onAbort);

      function cleanup() {
        signal?.removeEventListener('abort', onAbort);
        port.disconnect();
      }

      port.onMessage.addListener((raw) => {
        const message = raw as LlmPortResponse;
        if (message.requestId !== requestId) return;

        if (message.type === 'delta') {
          callbacks.onDelta?.(message.text);
        } else if (message.type === 'usage') {
          callbacks.onUsage?.(message.usage);
        } else if (message.type === 'done') {
          settled = true;
          cleanup();
          resolve(message.result);
        } else if (message.type === 'error') {
          settled = true;
          cleanup();
          reject(new LlmError(message.error.kind, message.error.message, message.error.status));
        }
      });

      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        reject(new LlmError('network', '与 background 的连接已断开'));
      });

      const request: LlmPortRequest = { type: 'start', requestId, params };
      port.postMessage(request);
    });
}

export const realStreamChatCompletion = createRealStreamChatCompletion();
