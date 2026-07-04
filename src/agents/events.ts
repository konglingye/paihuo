/** 派活儿目前会触发的事件（arch §5）；新事件加到这个联合类型里 */
export type PaihuoEvent =
  | { type: 'dump.created'; fragmentId: string }
  | { type: 'task.completed'; taskId: string }
  | { type: 'alarm.eod' }
  | { type: 'settings.changed' };

export type EventHandler = (event: PaihuoEvent) => void | Promise<void>;

export interface EventRule {
  /** 唯一标识，setEnabled 按这个开关规则 */
  name: string;
  event: PaihuoEvent['type'];
  handler: EventHandler;
}

/**
 * 轻量事件总线（arch §5）：规则是纯数据（一条条注册进来的 {name, event, handler}），可以按 name 开关。
 * 自动触发的规则不许调 ui/external 工具——这条约束不由总线强制，而是靠"规则内部从不给 runAgent 传
 * allowUiExternal:true"来保证（自动触发的 profile 本来也没有 ui/external 工具在白名单里）。
 */
export class EventBus {
  private rules: EventRule[] = [];
  private disabled = new Set<string>();

  register(rule: EventRule): void {
    this.rules.push(rule);
  }

  setEnabled(name: string, enabled: boolean): void {
    if (enabled) this.disabled.delete(name);
    else this.disabled.add(name);
  }

  isEnabled(name: string): boolean {
    return !this.disabled.has(name);
  }

  listRules(): EventRule[] {
    return [...this.rules];
  }

  /** 触发一个事件；返回逐条规则的执行结果（settled）——某条规则报错不影响其它规则，也不让 emit 本身 reject */
  async emit(event: PaihuoEvent): Promise<PromiseSettledResult<void>[]> {
    const matched = this.rules.filter((r) => r.event === event.type && this.isEnabled(r.name));
    return Promise.allSettled(matched.map((r) => Promise.resolve().then(() => r.handler(event))));
  }
}

/** 全局单例：sidepanel 和 background 各自的 JS 上下文里各有一份（MV3 两个上下文不共享模块状态） */
export const eventBus = new EventBus();
