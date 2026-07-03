import {
  LlmError,
  type StreamChatCompletionCallbacks,
  type StreamChatCompletionParams,
  type StreamChatCompletionResult,
  type Usage,
} from './types';

const DEFAULT_TIMEOUT_MS = 30000;

interface RawStreamChunk {
  choices?: { delta?: { content?: string } }[];
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

/** 经统一 harness 调用的 OpenAI 兼容 SSE 流式传输。真实网络请求只应在 background 里发起（见 background-bridge.ts）。 */
export async function streamChatCompletion(
  params: StreamChatCompletionParams,
  callbacks: StreamChatCompletionCallbacks,
  signal?: AbortSignal,
): Promise<StreamChatCompletionResult> {
  const { baseUrl, apiKey, model, messages, temperature, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
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
        body: JSON.stringify({ model, messages, temperature, stream: true }),
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

async function parseSse(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamChatCompletionCallbacks,
): Promise<StreamChatCompletionResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage: Usage | undefined;

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
        if (dataStr === '[DONE]') return { content, usage };

        let chunk: RawStreamChunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch {
          continue;
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          callbacks.onDelta?.(delta);
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
    return { content, usage };
  } finally {
    reader.releaseLock();
  }
}
