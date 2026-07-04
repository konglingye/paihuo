import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';

describe('EventBus（arch §5：轻量事件总线，规则=纯数据，可开关）', () => {
  it('emit 时触发所有匹配该事件类型的规则', async () => {
    const bus = new EventBus();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.register({ name: 'a', event: 'task.completed', handler: handlerA });
    bus.register({ name: 'b', event: 'task.completed', handler: handlerB });

    await bus.emit({ type: 'task.completed', taskId: 't1' });

    expect(handlerA).toHaveBeenCalledWith({ type: 'task.completed', taskId: 't1' });
    expect(handlerB).toHaveBeenCalledWith({ type: 'task.completed', taskId: 't1' });
  });

  it('不匹配事件类型的规则不会被触发', async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.register({ name: 'a', event: 'dump.created', handler });

    await bus.emit({ type: 'task.completed', taskId: 't1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('setEnabled(false) 之后规则不再触发；重新 enable 后恢复', async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.register({ name: 'a', event: 'task.completed', handler });

    bus.setEnabled('a', false);
    await bus.emit({ type: 'task.completed', taskId: 't1' });
    expect(handler).not.toHaveBeenCalled();

    bus.setEnabled('a', true);
    await bus.emit({ type: 'task.completed', taskId: 't1' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('一个规则的 handler 抛错不影响其他规则执行，emit 本身不会 reject', async () => {
    const bus = new EventBus();
    const okHandler = vi.fn();
    bus.register({
      name: 'broken',
      event: 'task.completed',
      handler: () => {
        throw new Error('坏了');
      },
    });
    bus.register({ name: 'ok', event: 'task.completed', handler: okHandler });

    const results = await bus.emit({ type: 'task.completed', taskId: 't1' });

    expect(okHandler).toHaveBeenCalledOnce();
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('异步 handler 会被 emit 等待完成（settled 结果里能看到）', async () => {
    const bus = new EventBus();
    let resolved = false;
    bus.register({
      name: 'async-rule',
      event: 'dump.created',
      handler: async () => {
        await new Promise((r) => setTimeout(r, 5));
        resolved = true;
      },
    });

    await bus.emit({ type: 'dump.created', fragmentId: 'f1' });
    expect(resolved).toBe(true);
  });

  it('listRules 返回已注册规则的快照', () => {
    const bus = new EventBus();
    bus.register({ name: 'a', event: 'task.completed', handler: () => {} });
    expect(bus.listRules().map((r) => r.name)).toEqual(['a']);
  });
});
