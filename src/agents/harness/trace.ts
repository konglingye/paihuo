import type { ToolCallResult } from './tools';
import type { Usage } from '@/src/llm/types';

export type AgentRunOutcome = 'text' | 'contract' | 'contract_fallback' | 'bailout' | 'error' | 'aborted';

export interface TraceToolCall {
  name: string;
  args: unknown;
  result: ToolCallResult;
}

export interface TraceTurn {
  turn: number;
  assistantText: string;
  toolCalls: TraceToolCall[];
  usage?: Usage;
  durationMs: number;
}

export interface AgentRun {
  id: string;
  profileName: string;
  inputSummary: string;
  turns: TraceTurn[];
  outcome: AgentRunOutcome;
  finalText: string;
  finalOutput?: unknown;
  error?: { kind: string; message: string };
  startedAt: number;
  finishedAt: number;
}

/** 单次 run 内累积逐轮记录，最终产出 arch §6 定义的 AgentRun 数据结构（持久化+#/trace 页留给 T08） */
export class TraceBuilder {
  private turns: TraceTurn[] = [];
  private startedAt = Date.now();

  constructor(
    private profileName: string,
    private inputSummary: string,
  ) {}

  addTurn(turn: TraceTurn): void {
    this.turns.push(turn);
  }

  finish(
    outcome: AgentRunOutcome,
    finalText: string,
    opts: { finalOutput?: unknown; error?: { kind: string; message: string } } = {},
  ): AgentRun {
    return {
      id: crypto.randomUUID(),
      profileName: this.profileName,
      inputSummary: this.inputSummary,
      turns: this.turns,
      outcome,
      finalText,
      finalOutput: opts.finalOutput,
      error: opts.error,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
    };
  }
}
