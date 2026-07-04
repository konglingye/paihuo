import { z } from 'zod';
import { useTasksStore } from '@/src/store/tasksStore';
import { useReportTemplateStore } from '@/src/store/reportTemplateStore';
import type { Task } from '@/src/store/schema';
import type { ToolDefinition } from '../harness/tools';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { today: 1, week: 7, month: 30 } as const;

function summarize(task: Task) {
  return { id: task.id, title: task.title, type: task.type, due: task.due };
}

const QueryTaskHistoryParams = z.object({ range: z.enum(['today', 'week', 'month']) });

/**
 * 按时间范围查任务完成/进行中情况，供写日报/周报/月报用（spec §6.4）。
 * "进行中"不受时间范围限制——手里压着的活儿不管什么时候建的都得报，只有"完成"才按 range 圈定窗口。
 */
export const queryTaskHistoryTool: ToolDefinition<z.infer<typeof QueryTaskHistoryParams>> = {
  name: 'query_task_history',
  description: '按时间范围（today=今天/week=近7天/month=近30天）查任务完成与进行中情况，写报告用',
  paramsSchema: QueryTaskHistoryParams,
  effect: 'read',
  handler: ({ range }) => {
    const cutoff = Date.now() - RANGE_DAYS[range] * DAY_MS;
    const allTasks = Object.values(useTasksStore.getState().tasks);
    const completed = allTasks.filter((t) => t.status === 'done' && t.doneAt !== undefined && t.doneAt >= cutoff);
    const inProgress = allTasks.filter((t) => t.status !== 'done');
    return {
      range,
      completed: completed.map(summarize),
      inProgress: inProgress.map(summarize),
      totalSavedMin: completed.reduce((sum, t) => sum + t.saveMin, 0),
    };
  },
};

/** 读取用户上传的公司模板全文（检索优先于灌注：模板名字已经在提示词里，全文按需读） */
export const readTemplateTool: ToolDefinition<Record<string, never>> = {
  name: 'read_template',
  description: '读取用户上传的公司模板全文',
  paramsSchema: z.object({}),
  effect: 'read',
  handler: () => {
    const template = useReportTemplateStore.getState().template;
    if (!template) throw new Error('用户没有上传模板');
    return { name: template.name, text: template.text };
  },
};

export const reportTools: ToolDefinition[] = [queryTaskHistoryTool, readTemplateTool];
