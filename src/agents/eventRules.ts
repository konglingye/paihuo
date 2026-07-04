import { runOrganize } from './runOrganize';
import { useTasksStore } from '@/src/store/tasksStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { useReportsStore } from '@/src/store/reportsStore';
import { useUiStore } from '@/src/store/uiStore';
import { useWorklogStore } from '@/src/store/worklogStore';
import type { EventBus } from './events';
import type { ToolRegistry } from './harness/tools';
import type { LlmDriver } from './harness/llmDriver';

export interface EventRuleDeps {
  registry: ToolRegistry;
  llm: LlmDriver;
  defaultModel: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 默认规则表（arch §5）。getDeps 每次触发时才调用——保证用的是当前最新的 settings（llm/model 可能中途改过），
 * 不是注册时就固定死的快照。自动触发的规则从不传 allowUiExternal，ui/external 工具天然调不到。
 */
export function registerDefaultEventRules(bus: EventBus, getDeps: () => EventRuleDeps): void {
  bus.register({
    name: 'dump.created->auto-organize',
    event: 'dump.created',
    handler: async () => {
      const activeTasks = Object.values(useTasksStore.getState().tasks).filter((t) => t.status !== 'done');
      // 整理官找的是"任务之间"的关联，少于两件没什么好找的，省一次没必要的 LLM 调用
      if (activeTasks.length < 2) return;
      await runOrganize(activeTasks, getDeps());
    },
  });

  bus.register({
    name: 'task.completed->suggest-next',
    event: 'task.completed',
    handler: (event) => {
      if (event.type !== 'task.completed') return;
      const tasks = useTasksStore.getState().tasks;
      const completedTask = tasks[event.taskId];
      if (!completedTask) return;

      const relations = useRelationsStore.getState().relations.filter((r) => r.taskIds.includes(event.taskId));
      for (const relation of relations) {
        const nextTask = relation.taskIds
          .filter((id) => id !== event.taskId)
          .map((id) => tasks[id])
          .find((t) => t && t.status !== 'done');
        if (nextTask) {
          useUiStore.getState().notify(`「${completedTask.title}」搞定了，建议接着做「${nextTask.title}」`);
          return;
        }
      }
    },
  });

  bus.register({
    name: 'alarm.eod->check-report-reminder',
    event: 'alarm.eod',
    handler: () => {
      const date = todayKey();
      const tasks = Object.values(useTasksStore.getState().tasks);
      const hasReportToday = useReportsStore
        .getState()
        .reports.some((r) => new Date(r.createdAt).toISOString().slice(0, 10) === date);
      useWorklogStore.getState().checkEodAlarm(date, tasks, hasReportToday);
    },
  });
}
