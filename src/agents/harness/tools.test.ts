import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, executeToolCalls } from './tools';
import type { ToolDefinition } from './tools';

function makeRegistry(tools: ToolDefinition[]): ToolRegistry {
  const registry = new ToolRegistry();
  tools.forEach((t) => registry.register(t));
  return registry;
}

const echoTool: ToolDefinition<{ text: string }, string> = {
  name: 'echo',
  description: '原样返回输入文本',
  paramsSchema: z.object({ text: z.string() }),
  effect: 'read',
  handler: ({ text }) => text,
};

describe('ToolRegistry', () => {
  it('register 后能 get 到工具', () => {
    const registry = makeRegistry([echoTool]);
    expect(registry.get('echo')).toBe(echoTool);
  });

  it('重复注册同名工具报错', () => {
    const registry = makeRegistry([echoTool]);
    expect(() => registry.register(echoTool)).toThrow();
  });

  it('list 支持按白名单子集过滤（profile 拿工具白名单）', () => {
    const other: ToolDefinition = { ...echoTool, name: 'other' };
    const registry = makeRegistry([echoTool, other]);
    expect(registry.list(['echo']).map((t) => t.name)).toEqual(['echo']);
  });

  it('toJsonSchemaList 把 zod schema 转成 JSON Schema 供模型使用', () => {
    const registry = makeRegistry([echoTool]);
    const [schema] = registry.toJsonSchemaList();
    expect(schema.name).toBe('echo');
    expect(schema.parameters).toMatchObject({
      type: 'object',
      properties: { text: { type: 'string' } },
    });
  });
});

describe('executeToolCalls', () => {
  it('schema 校验失败时返回结构化错误，不抛异常', async () => {
    const registry = makeRegistry([echoTool]);
    const [result] = await executeToolCalls(registry, [{ name: 'echo', args: { text: 123 } }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_params');
  });

  it('调用未注册的工具返回结构化错误', async () => {
    const registry = makeRegistry([echoTool]);
    const [result] = await executeToolCalls(registry, [{ name: 'not_exist', args: {} }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown_tool');
  });

  it('handler 抛异常时归为 handler_error，不炸掉整个 run', async () => {
    const boom: ToolDefinition = {
      name: 'boom',
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'read',
      handler: () => {
        throw new Error('内部炸了');
      },
    };
    const registry = makeRegistry([boom]);
    const [result] = await executeToolCalls(registry, [{ name: 'boom', args: {} }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('handler_error');
      expect(result.error.message).toContain('内部炸了');
    }
  });

  it('handler 超过超时时间归为 timeout', async () => {
    const slow: ToolDefinition = {
      name: 'slow',
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'read',
      handler: () => new Promise((resolve) => setTimeout(resolve, 200)),
    };
    const registry = makeRegistry([slow]);
    const [result] = await executeToolCalls(registry, [{ name: 'slow', args: {} }], { timeoutMs: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('timeout');
  });

  it('handler 成功时返回 ok 结果', async () => {
    const registry = makeRegistry([echoTool]);
    const [result] = await executeToolCalls(registry, [{ name: 'echo', args: { text: 'hi' } }]);
    expect(result).toEqual({ ok: true, toolName: 'echo', result: 'hi' });
  });

  it('effect=ui/external 默认拒绝执行，需要 allowUiExternal 才放行', async () => {
    const uiTool: ToolDefinition = {
      name: 'reveal_card',
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'ui',
      handler: () => 'revealed',
    };
    const registry = makeRegistry([uiTool]);

    const [blocked] = await executeToolCalls(registry, [{ name: 'reveal_card', args: {} }]);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('requires_confirmation');

    const [allowed] = await executeToolCalls(registry, [{ name: 'reveal_card', args: {} }], {
      allowUiExternal: true,
    });
    expect(allowed).toEqual({ ok: true, toolName: 'reveal_card', result: 'revealed' });
  });

  it('连续的 read 调用并行执行（总耗时接近单个最长耗时，而非叠加）', async () => {
    const makeDelay = (name: string, ms: number): ToolDefinition => ({
      name,
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'read',
      handler: () => new Promise((resolve) => setTimeout(() => resolve(name), ms)),
    });
    const registry = makeRegistry([makeDelay('r1', 60), makeDelay('r2', 60), makeDelay('r3', 60)]);

    const start = performance.now();
    const results = await executeToolCalls(registry, [
      { name: 'r1', args: {} },
      { name: 'r2', args: {} },
      { name: 'r3', args: {} },
    ]);
    const elapsed = performance.now() - start;

    expect(results.every((r) => r.ok)).toBe(true);
    // 串行执行会 >= 180ms；并行应明显低于 3 个耗时之和
    expect(elapsed).toBeLessThan(150);
  });

  it('write 调用严格按顺序串行执行（不会交叠）', async () => {
    const order: string[] = [];
    const makeWrite = (name: string, ms: number): ToolDefinition => ({
      name,
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'write',
      handler: () =>
        new Promise((resolve) => {
          order.push(`${name}:start`);
          setTimeout(() => {
            order.push(`${name}:end`);
            resolve(name);
          }, ms);
        }),
    });
    const registry = makeRegistry([makeWrite('w1', 30), makeWrite('w2', 10)]);

    await executeToolCalls(registry, [
      { name: 'w1', args: {} },
      { name: 'w2', args: {} },
    ]);

    // 若是并行执行，w2 会先于 w1 结束；串行执行必须严格 w1 完整结束后才轮到 w2
    expect(order).toEqual(['w1:start', 'w1:end', 'w2:start', 'w2:end']);
  });

  it('read 与 write 混合时，write 会打断 read 批次分别处理', async () => {
    const order: string[] = [];
    const read: ToolDefinition = {
      name: 'r',
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'read',
      handler: () => {
        order.push('r');
        return 'r';
      },
    };
    const write: ToolDefinition = {
      name: 'w',
      description: 'x',
      paramsSchema: z.object({}),
      effect: 'write',
      handler: () => {
        order.push('w');
        return 'w';
      },
    };
    const registry = makeRegistry([read, write]);
    const results = await executeToolCalls(registry, [
      { name: 'r', args: {} },
      { name: 'w', args: {} },
      { name: 'r', args: {} },
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(order).toEqual(['r', 'w', 'r']);
  });
});
