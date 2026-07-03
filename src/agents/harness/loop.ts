import type { z } from 'zod';
import { LlmError, type ChatMessage } from '@/src/llm/types';
import {
  DEFAULT_MAX_TOOL_CALLS_PER_TURN,
  DEFAULT_MAX_TURNS,
  isIdleTurn,
  type TurnSignature,
} from './budget';
import { executeToolCalls, ToolRegistry } from './tools';
import { TraceBuilder, type AgentRun } from './trace';
import type { LlmDriver, LlmDriverCallbacks, LlmDriverResult, LlmDriverToolCall } from './llmDriver';

export interface AgentProfile {
  name: string;
  systemPrompt: string;
  /** 这个 profile 能用的工具白名单（子集） */
  toolNames: string[];
  maxTurns?: number;
  maxToolCallsPerTurn?: number;
  /** 带 outputContract 的 profile，终局文本必须过这个 zod schema 校验 */
  outputContract?: z.ZodType<unknown>;
  /** 契约重试一次后仍失败时的降级路径（如：把原文塞一张"待手动拆"卡） */
  fallback?: (rawText: string) => unknown;
  params?: { model?: string; temperature?: number };
}

export interface RunAgentDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  /** profile 没指定 model 时用这个（用户在设置里选的模型） */
  defaultModel: string;
  /** ui/external 工具默认拒绝，只有确实处在用户手势会话内才应该传 true */
  allowUiExternal?: boolean;
  /** 429/网络/超时错误退避重试的等待时间（毫秒），默认 300；测试可传 0 */
  retryDelayMs?: number;
}

export interface RunAgentOptions {
  signal?: AbortSignal;
  /** 文本增量实时上抛给 UI（活动指示） */
  onDelta?: (text: string) => void;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

type ContractValidation = { success: true; data: unknown } | { success: false; error: string };

function validateContract(contract: z.ZodType<unknown> | undefined, text: string): ContractValidation {
  if (!contract) return { success: true, data: text };
  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(text));
  } catch (err) {
    return { success: false, error: `JSON 解析失败：${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = contract.safeParse(json);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, error: parsed.error.message };
}

/** 429/网络/超时退避重试 1 次；401/403 不重试，直接把错误交回上层（终止并引导设置页） */
async function callLlmWithRetry(
  deps: RunAgentDeps,
  messages: ChatMessage[],
  tools: { name: string; description: string; parameters: object }[],
  params: { model: string; temperature?: number },
  callbacks: LlmDriverCallbacks,
  signal: AbortSignal | undefined,
): Promise<LlmDriverResult> {
  try {
    return await deps.llm(messages, tools, params, callbacks, signal);
  } catch (err) {
    const llmError = err instanceof LlmError ? err : new LlmError('unknown', String(err));
    if (llmError.kind === 'rate_limited' || llmError.kind === 'network' || llmError.kind === 'timeout') {
      await delay(deps.retryDelayMs ?? 300);
      return await deps.llm(messages, tools, params, callbacks, signal);
    }
    throw llmError;
  }
}

function toChatToolCallParts(toolCalls: LlmDriverToolCall[]): ChatMessage['toolCalls'] {
  return toolCalls.map((tc) => ({ id: tc.id, name: tc.name, arguments: JSON.stringify(tc.args) }));
}

/** 多轮工具调用循环：agent 架构的心脏。arch §1。 */
export async function runAgent(
  profile: AgentProfile,
  input: string,
  deps: RunAgentDeps,
  options: RunAgentOptions = {},
): Promise<AgentRun> {
  const maxTurns = profile.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxToolCallsPerTurn = profile.maxToolCallsPerTurn ?? DEFAULT_MAX_TOOL_CALLS_PER_TURN;
  const model = profile.params?.model ?? deps.defaultModel;
  const llmParams = { model, temperature: profile.params?.temperature };
  const llmCallbacks: LlmDriverCallbacks = { onDelta: options.onDelta };

  const messages: ChatMessage[] = [
    { role: 'system', content: profile.systemPrompt },
    { role: 'user', content: input },
  ];
  const tools = deps.registry.toJsonSchemaList(profile.toolNames);
  const trace = new TraceBuilder(profile.name, input);

  let previousSignature: TurnSignature | undefined;
  let idleCount = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (options.signal?.aborted) {
      return trace.finish('aborted', '', { error: { kind: 'aborted', message: '已取消' } });
    }

    const turnStart = Date.now();
    let llmResult: LlmDriverResult;
    try {
      llmResult = await callLlmWithRetry(deps, messages, tools, llmParams, llmCallbacks, options.signal);
    } catch (err) {
      const llmError = err instanceof LlmError ? err : new LlmError('unknown', String(err));
      const outcome = llmError.kind === 'aborted' ? 'aborted' : 'error';
      return trace.finish(outcome, '', { error: { kind: llmError.kind, message: llmError.message } });
    }

    const cappedToolCalls = llmResult.toolCalls.slice(0, maxToolCallsPerTurn);

    if (cappedToolCalls.length === 0) {
      trace.addTurn({
        turn,
        assistantText: llmResult.text,
        toolCalls: [],
        usage: llmResult.usage,
        durationMs: Date.now() - turnStart,
      });
      return finalizeTextTurn(profile, llmResult.text, deps, messages, tools, llmParams, llmCallbacks, options, trace, turn);
    }

    const signature: TurnSignature = {
      text: llmResult.text,
      toolCalls: cappedToolCalls.map((tc) => ({ name: tc.name, args: tc.args })),
    };
    idleCount = isIdleTurn(signature, previousSignature) ? idleCount + 1 : 0;
    previousSignature = signature;

    const toolResults = await executeToolCalls(
      deps.registry,
      cappedToolCalls.map((tc) => ({ name: tc.name, args: tc.args })),
      { allowUiExternal: deps.allowUiExternal },
    );

    trace.addTurn({
      turn,
      assistantText: llmResult.text,
      toolCalls: cappedToolCalls.map((tc, i) => ({ name: tc.name, args: tc.args, result: toolResults[i] })),
      usage: llmResult.usage,
      durationMs: Date.now() - turnStart,
    });

    if (idleCount >= 2) {
      return trace.finish('bailout', '');
    }

    messages.push({ role: 'assistant', content: llmResult.text, toolCalls: toChatToolCallParts(cappedToolCalls) });
    cappedToolCalls.forEach((tc, i) => {
      messages.push({ role: 'tool', toolCallId: tc.id, content: JSON.stringify(toolResults[i]) });
    });
  }

  return trace.finish('bailout', '');
}

/** 文本终局：没有 outputContract 直接收尾；有的话校验失败重试 1 次，再失败走 fallback 或 bailout */
async function finalizeTextTurn(
  profile: AgentProfile,
  firstAttemptText: string,
  deps: RunAgentDeps,
  messages: ChatMessage[],
  tools: { name: string; description: string; parameters: object }[],
  llmParams: { model: string; temperature?: number },
  llmCallbacks: LlmDriverCallbacks,
  options: RunAgentOptions,
  trace: TraceBuilder,
  turnIndex: number,
): Promise<AgentRun> {
  if (!profile.outputContract) {
    return trace.finish('text', firstAttemptText);
  }

  let attemptText = firstAttemptText;
  let validation = validateContract(profile.outputContract, attemptText);

  if (!validation.success) {
    messages.push({ role: 'assistant', content: attemptText });
    messages.push({
      role: 'user',
      content: `你上一次的输出没有通过校验：${validation.error}\n请只输出符合契约的 JSON，不要加任何解释文字。`,
    });

    const retryStart = Date.now();
    try {
      const retryResult = await callLlmWithRetry(deps, messages, tools, llmParams, llmCallbacks, options.signal);
      trace.addTurn({
        turn: turnIndex + 1,
        assistantText: retryResult.text,
        toolCalls: [],
        usage: retryResult.usage,
        durationMs: Date.now() - retryStart,
      });
      attemptText = retryResult.text;
      validation = validateContract(profile.outputContract, attemptText);
    } catch (err) {
      const llmError = err instanceof LlmError ? err : new LlmError('unknown', String(err));
      const outcome = llmError.kind === 'aborted' ? 'aborted' : 'error';
      return trace.finish(outcome, attemptText, { error: { kind: llmError.kind, message: llmError.message } });
    }
  }

  if (validation.success) {
    return trace.finish('contract', attemptText, { finalOutput: validation.data });
  }
  if (profile.fallback) {
    return trace.finish('contract_fallback', attemptText, { finalOutput: profile.fallback(attemptText) });
  }
  return trace.finish('bailout', attemptText);
}
