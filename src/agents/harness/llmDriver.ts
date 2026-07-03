import { streamChatCompletion as defaultStreamChatCompletion } from '@/src/llm/client';
import type { ChatMessage, LlmToolSpec, StreamChatCompletion, Usage } from '@/src/llm/types';

export interface LlmDriverCallbacks {
  onDelta?: (text: string) => void;
  onUsage?: (usage: Usage) => void;
}

export interface LlmDriverToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface LlmDriverResult {
  text: string;
  toolCalls: LlmDriverToolCall[];
  usage?: Usage;
}

export type LlmDriver = (
  messages: ChatMessage[],
  tools: LlmToolSpec[],
  params: { model: string; temperature?: number },
  callbacks: LlmDriverCallbacks,
  signal?: AbortSignal,
) => Promise<LlmDriverResult>;

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { __parse_error: true, raw };
  }
}

/** 生产环境用的驱动：接到 client.ts（mock/real 分流）上；测试可注入别的 streamImpl 脚本化断言 */
export function createLlmDriver(
  settings: { baseUrl: string; apiKey: string },
  streamImpl: StreamChatCompletion = defaultStreamChatCompletion,
): LlmDriver {
  return async (messages, tools, params, callbacks, signal) => {
    const result = await streamImpl(
      {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: params.model,
        temperature: params.temperature,
        messages,
        tools,
      },
      callbacks,
      signal,
    );

    return {
      text: result.content,
      usage: result.usage,
      toolCalls: (result.toolCalls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: parseArguments(tc.arguments),
      })),
    };
  };
}
