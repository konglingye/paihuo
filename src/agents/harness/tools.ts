import { z } from 'zod';

export type ToolEffect = 'read' | 'write' | 'ui' | 'external';

export interface ToolDefinition<TParams = any, TResult = any> {
  /** 唯一标识，同时是模型看到的函数名 */
  name: string;
  /** 中文，面向模型说明这个工具是干什么的 */
  description: string;
  paramsSchema: z.ZodType<TParams>;
  effect: ToolEffect;
  handler: (params: TParams) => TResult | Promise<TResult>;
}

export interface ToolCallRequest {
  name: string;
  args: unknown;
}

export type ToolCallErrorCode =
  | 'unknown_tool'
  | 'invalid_params'
  | 'requires_confirmation'
  | 'timeout'
  | 'handler_error';

export type ToolCallResult<T = unknown> =
  | { ok: true; toolName: string; result: T }
  | { ok: false; toolName: string; error: { code: ToolCallErrorCode; message: string } };

const DEFAULT_TIMEOUT_MS = 10000;

/** 工具注册表：schema 校验用 zod，暴露给模型用 JSON Schema（zod v4 原生 toJSONSchema） */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具重复注册：${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** 不传 names 时返回全部；传了则按白名单过滤（每个 profile 拿工具白名单子集） */
  list(names?: string[]): ToolDefinition[] {
    const all = [...this.tools.values()];
    return names ? all.filter((t) => names.includes(t.name)) : all;
  }

  toJsonSchemaList(names?: string[]): { name: string; description: string; parameters: object }[] {
    return this.list(names).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.paramsSchema),
    }));
  }
}

export interface ExecuteToolCallsOptions {
  /** 单次工具调用超时（毫秒），默认 10000 */
  timeoutMs?: number;
  /** ui/external 工具默认拒绝执行；只有确实处在用户手势会话内才应该传 true */
  allowUiExternal?: boolean;
}

class ToolTimeoutError extends Error {}

function withTimeout<T>(run: () => T | Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ToolTimeoutError('工具执行超时')), timeoutMs);
    Promise.resolve()
      .then(run)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function runToolSafely(
  tool: ToolDefinition,
  call: ToolCallRequest,
  timeoutMs: number,
): Promise<ToolCallResult> {
  const parsed = tool.paramsSchema.safeParse(call.args);
  if (!parsed.success) {
    return {
      ok: false,
      toolName: tool.name,
      error: { code: 'invalid_params', message: parsed.error.message },
    };
  }
  try {
    const result = await withTimeout(() => tool.handler(parsed.data), timeoutMs);
    return { ok: true, toolName: tool.name, result };
  } catch (err) {
    if (err instanceof ToolTimeoutError) {
      return { ok: false, toolName: tool.name, error: { code: 'timeout', message: err.message } };
    }
    return {
      ok: false,
      toolName: tool.name,
      error: { code: 'handler_error', message: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * 按 effect 分级执行一批工具调用：
 * - 连续的 read 调用一起并行跑；write/ui/external 严格按原顺序串行跑（不会和相邻批次交叠）。
 * - ui/external 默认拒绝执行，除非 allowUiExternal（真实处在用户手势会话内）。
 */
export async function executeToolCalls(
  registry: ToolRegistry,
  calls: ToolCallRequest[],
  options: ExecuteToolCallsOptions = {},
): Promise<ToolCallResult[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const results: ToolCallResult[] = new Array(calls.length);
  let i = 0;

  while (i < calls.length) {
    const call = calls[i];
    const tool = registry.get(call.name);

    if (!tool) {
      results[i] = {
        ok: false,
        toolName: call.name,
        error: { code: 'unknown_tool', message: `未注册的工具：${call.name}` },
      };
      i += 1;
      continue;
    }

    if ((tool.effect === 'ui' || tool.effect === 'external') && !options.allowUiExternal) {
      results[i] = {
        ok: false,
        toolName: call.name,
        error: { code: 'requires_confirmation', message: '该工具需要用户手势或确认后才能执行' },
      };
      i += 1;
      continue;
    }

    if (tool.effect === 'read') {
      const batch: { index: number; tool: ToolDefinition; call: ToolCallRequest }[] = [];
      while (i < calls.length) {
        const t = registry.get(calls[i].name);
        if (!t || t.effect !== 'read') break;
        batch.push({ index: i, tool: t, call: calls[i] });
        i += 1;
      }
      const batchResults = await Promise.all(
        batch.map(({ tool: batchTool, call: batchCall }) => runToolSafely(batchTool, batchCall, timeoutMs)),
      );
      batch.forEach(({ index }, bi) => {
        results[index] = batchResults[bi];
      });
      continue;
    }

    results[i] = await runToolSafely(tool, call, timeoutMs);
    i += 1;
  }

  return results;
}
