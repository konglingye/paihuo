import { z } from 'zod';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { FitSchema, TaskDueSchema, TaskStatusSchema, TaskTypeSchema } from '@/src/store/schema';
import type { ToolDefinition } from '../harness/tools';

const TaskDraftSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
  type: TaskTypeSchema,
  fit: FitSchema,
  toolId: z.string().optional(),
  prompt: z.string().optional(),
  due: TaskDueSchema.optional(),
  groupId: z.string().optional(),
  saveMin: z.number(),
  fragmentId: z.string(),
});

function requireTask(id: string) {
  const task = useTasksStore.getState().tasks[id];
  if (!task) throw new Error(`任务不存在：${id}`);
  return task;
}

const ListTasksParams = z.object({
  type: TaskTypeSchema.optional(),
  status: TaskStatusSchema.optional(),
  groupId: z.string().optional(),
});

export const listTasksTool: ToolDefinition<z.infer<typeof ListTasksParams>> = {
  name: 'list_tasks',
  description: '按类型/状态/分组筛选任务列表',
  paramsSchema: ListTasksParams,
  effect: 'read',
  handler: (params) =>
    Object.values(useTasksStore.getState().tasks).filter(
      (task) =>
        (params.type ? task.type === params.type : true) &&
        (params.status ? task.status === params.status : true) &&
        (params.groupId ? task.groupId === params.groupId : true),
    ),
};

const GetTaskParams = z.object({ id: z.string() });

export const getTaskTool: ToolDefinition<z.infer<typeof GetTaskParams>> = {
  name: 'get_task',
  description: '按 id 获取单个任务详情',
  paramsSchema: GetTaskParams,
  effect: 'read',
  handler: ({ id }) => requireTask(id),
};

const CreateTasksParams = z.object({ drafts: z.array(TaskDraftSchema).min(1) });

export const createTasksTool: ToolDefinition<z.infer<typeof CreateTasksParams>> = {
  name: 'create_tasks',
  description: '批量创建任务草稿',
  paramsSchema: CreateTasksParams,
  effect: 'write',
  handler: ({ drafts }) => useTasksStore.getState().addTasks(drafts),
};

const UpdateTaskParams = z.object({
  id: z.string(),
  patch: z.object({
    title: z.string().optional(),
    note: z.string().optional(),
    type: TaskTypeSchema.optional(),
    fit: FitSchema.optional(),
    status: TaskStatusSchema.optional(),
    toolId: z.string().optional(),
    prompt: z.string().optional(),
    due: TaskDueSchema.optional(),
    groupId: z.string().optional(),
    saveMin: z.number().optional(),
  }),
});

export const updateTaskTool: ToolDefinition<z.infer<typeof UpdateTaskParams>> = {
  name: 'update_task',
  description: '局部更新任务字段',
  paramsSchema: UpdateTaskParams,
  effect: 'write',
  handler: ({ id, patch }) => {
    requireTask(id);
    useTasksStore.getState().updateTask(id, patch);
    return requireTask(id);
  },
};

const CompleteTaskParams = z.object({ id: z.string() });

export const completeTaskTool: ToolDefinition<z.infer<typeof CompleteTaskParams>> = {
  name: 'complete_task',
  description: '把任务标记为已完成',
  paramsSchema: CompleteTaskParams,
  effect: 'write',
  handler: ({ id }) => {
    requireTask(id);
    useTasksStore.getState().completeTask(id);
    return requireTask(id);
  },
};

const GroupTasksParams = z.object({ ids: z.array(z.string()).min(1), label: z.string() });

export const groupTasksTool: ToolDefinition<z.infer<typeof GroupTasksParams>> = {
  name: 'group_tasks',
  description: '把若干任务归到一个新分组下（如同一场活动牵出的多个任务）',
  paramsSchema: GroupTasksParams,
  effect: 'write',
  handler: ({ ids, label }) => {
    ids.forEach(requireTask);
    const group = useGroupsStore.getState().addGroup({ label, kind: 'project' });
    ids.forEach((id) => useTasksStore.getState().updateTask(id, { groupId: group.id }));
    return { group, taskIds: ids };
  },
};

const LinkTasksParams = z.object({ ids: z.array(z.string()).min(2), reason: z.string() });

export const linkTasksTool: ToolDefinition<z.infer<typeof LinkTasksParams>> = {
  name: 'link_tasks',
  description: '记录若干任务之间的关联（同一交付物/同一活动/同一数据源），供后续提示合并推进',
  paramsSchema: LinkTasksParams,
  effect: 'write',
  handler: ({ ids, reason }) => {
    ids.forEach(requireTask);
    return useRelationsStore.getState().addRelation({ taskIds: ids, reason });
  },
};

export const taskTools: ToolDefinition[] = [
  listTasksTool,
  getTaskTool,
  createTasksTool,
  updateTaskTool,
  completeTaskTool,
  groupTasksTool,
  linkTasksTool,
];
