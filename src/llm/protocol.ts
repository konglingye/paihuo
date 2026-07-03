import type { LlmErrorKind, StreamChatCompletionParams, StreamChatCompletionResult, Usage } from './types';

/** sidepanel/对话等页面与 background service worker 之间转发 LLM 流式请求的 port 名 */
export const LLM_PORT_NAME = 'paihuo:llm-stream';

export interface LlmSerializedError {
  kind: LlmErrorKind;
  message: string;
  status?: number;
}

export type LlmPortRequest =
  | { type: 'start'; requestId: string; params: StreamChatCompletionParams }
  | { type: 'abort'; requestId: string };

export type LlmPortResponse =
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'usage'; requestId: string; usage: Usage }
  | { type: 'done'; requestId: string; result: StreamChatCompletionResult }
  | { type: 'error'; requestId: string; error: LlmSerializedError };

/** browser.runtime.Port 的最小接口子集，方便用假端口对测桥接逻辑 */
export interface PortLike {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
  disconnect(): void;
}
