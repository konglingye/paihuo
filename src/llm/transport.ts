import {
  LlmError,
  type ChatMessage,
  type StreamChatCompletionCallbacks,
  type StreamChatCompletionParams,
  type StreamChatCompletionResult,
  type ToolCallRequestPart,
  type Usage,
} from './types';

const DEFAULT_TIMEOUT_MS = 30000;

interface RawToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface RawStreamChunk {
  choices?: { delta?: { content?: string; tool_calls?: RawToolCallDelta[] } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

function classifyHttpError(status: number, bodyText: string): LlmError {
  let message = bodyText || `HTTP ${status}`;
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    // 非 JSON body，原样使用文本
  }
  if (status === 401 || status === 403) return new LlmError('unauthorized', message, status);
  if (status === 429) return new LlmError('rate_limited', message, status);
  return new LlmError('unknown', message, status);
}

/** 把内部消息格式序列化成 OpenAI 兼容的请求体消息 */
function toWireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId };
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

/** 经统一 harness 调用的 OpenAI 兼容 SSE 流式传输。真实网络请求只应在 background 里发起（见 background-bridge.ts）。 */
export async function streamChatCompletion(
  params: StreamChatCompletionParams,
  callbacks: StreamChatCompletionCallbacks,
  signal?: AbortSignal,
): Promise<StreamChatCompletionResult> {
  const { baseUrl, apiKey, model, messages, temperature, tools, maxTokens, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
  const internalController = new AbortController();
  let timedOut = false;
  let externallyAborted = false;

  const onExternalAbort = () => {
    externallyAborted = true;
    internalController.abort();
  };
  signal?.addEventListener('abort', onExternalAbort);

  const timer = setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, timeoutMs);

  const rethrowAbort = (err: unknown): never => {
    if (isAbortError(err)) {
      if (timedOut) throw new LlmError('timeout', '请求超时');
      if (externallyAborted) throw new LlmError('aborted', '已取消');
    }
    throw new LlmError('network', err instanceof Error ? err.message : String(err));
  };

  try {
    let response: Response;
    try {
      response = await fetch(joinUrl(baseUrl, '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(toWireMessage),
          temperature,
          stream: true,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
          ...(tools?.length
            ? {
                tools: tools.map((tool) => ({
                  type: 'function',
                  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
                })),
              }
            : {}),
        }),
        signal: internalController.signal,
      });
    } catch (err) {
      return rethrowAbort(err);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      throw classifyHttpError(response.status, bodyText);
    }
    if (!response.body) {
      throw new LlmError('network', '响应没有可读的 body');
    }

    try {
      return await parseSse(response.body, callbacks);
    } catch (err) {
      if (err instanceof LlmError) throw err;
      return rethrowAbort(err);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

interface ToolCallAccumulator {
  id?: string;
  name?: string;
  arguments: string;
}

async function parseSse(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamChatCompletionCallbacks,
): Promise<StreamChatCompletionResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage: Usage | undefined;
  const toolCallAccumulators = new Map<number, ToolCallAccumulator>();

  const finalize = (): StreamChatCompletionResult => {
    if (toolCallAccumulators.size === 0) return { content, usage };
    const toolCalls: ToolCallRequestPart[] = [...toolCallAccumulators.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, acc]) => ({ id: acc.id ?? '', name: acc.name ?? '', arguments: acc.arguments }));
    return { content, usage, toolCalls };
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice('data:'.length).trim();
        if (dataStr === '[DONE]') return finalize();

        let chunk: RawStreamChunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch {
          continue;
        }

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          callbacks.onDelta?.(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const acc = toolCallAccumulators.get(tc.index) ?? { arguments: '' };
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = (acc.name ?? '') + tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            toolCallAccumulators.set(tc.index, acc);
          }
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
          callbacks.onUsage?.(usage);
        }
      }
    }
    return finalize();
  } finally {
    reader.releaseLock();
  }
}
