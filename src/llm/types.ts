export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** 累积后的一次工具调用请求（agent loop 负责 JSON.parse(arguments) + zod 校验） */
export interface ToolCallRequestPart {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** role: 'tool' 时，对应回应哪次调用 */
  toolCallId?: string;
  /** role: 'assistant' 且这轮发起了工具调用时携带 */
  toolCalls?: ToolCallRequestPart[];
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

/** 暴露给模型的工具定义（与 ToolRegistry.toJsonSchemaList() 输出同形状） */
export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: object;
}

export interface StreamChatCompletionParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  /** 单次请求超时（毫秒），默认 30000 */
  timeoutMs?: number;
  tools?: LlmToolSpec[];
  /** 限制回复长度，测试连接时传 1 省钱 */
  maxTokens?: number;
}

export interface StreamChatCompletionCallbacks {
  onDelta?: (textChunk: string) => void;
  onUsage?: (usage: Usage) => void;
}

export interface StreamChatCompletionResult {
  content: string;
  usage?: Usage;
  toolCalls?: ToolCallRequestPart[];
}

export type StreamChatCompletion = (
  params: StreamChatCompletionParams,
  callbacks: StreamChatCompletionCallbacks,
  signal?: AbortSignal,
) => Promise<StreamChatCompletionResult>;
