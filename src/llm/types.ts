export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type LlmErrorKind =
  | 'unauthorized'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'aborted'
  | 'unknown';

export class LlmError extends Error {
  kind: LlmErrorKind;
  status?: number;

  constructor(kind: LlmErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
    this.status = status;
  }
}

export interface StreamChatCompletionParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  /** 单次请求超时（毫秒），默认 30000 */
  timeoutMs?: number;
}

export interface StreamChatCompletionCallbacks {
  onDelta?: (textChunk: string) => void;
  onUsage?: (usage: Usage) => void;
}

export interface StreamChatCompletionResult {
  content: string;
  usage?: Usage;
}

export type StreamChatCompletion = (
  params: StreamChatCompletionParams,
  callbacks: StreamChatCompletionCallbacks,
  signal?: AbortSignal,
) => Promise<StreamChatCompletionResult>;
