import type { ChatMessage } from '@/src/llm/types';

export const DEFAULT_MAX_TURNS = 6;
export const DEFAULT_MAX_TOOL_CALLS_PER_TURN = 4;
/** 单次 run 的估算 token 上限；各家模型没有统一 tokenizer，这只是估算 */
export const DEFAULT_TOKEN_BUDGET = 32000;

/** 中文启发式：chars/1.6，配合响应 usage 校准使用（arch §3.2） */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 1.6);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => {
    const toolCallChars = message.toolCalls?.reduce((n, tc) => n + tc.arguments.length, 0) ?? 0;
    return sum + estimateTokens(message.content) + (toolCallChars ? estimateTokens('x'.repeat(toolCallChars)) : 0);
  }, 0);
}

export interface TurnSignature {
  text: string;
  toolCalls: { name: string; args: unknown }[];
}

function sameToolCalls(a: TurnSignature['toolCalls'], b: TurnSignature['toolCalls']): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 连续两轮空转（无新信息）→ 强制收尾。空转 = 没有任何文本和工具调用，或和上一轮的工具调用完全重复 */
export function isIdleTurn(current: TurnSignature, previous: TurnSignature | undefined): boolean {
  const empty = !current.text.trim() && current.toolCalls.length === 0;
  if (empty) return true;
  if (previous && current.toolCalls.length > 0 && sameToolCalls(current.toolCalls, previous.toolCalls)) {
    return true;
  }
  return false;
}
