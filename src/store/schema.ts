import { z } from 'zod';

// 按 docs/00-product-spec.md §4 数据模型定义

export const TaskTypeSchema = z.enum(['write', 'slide', 'data', 'comm', 'misc']);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const FitSchema = z.enum(['full', 'assist', 'self']);
export type Fit = z.infer<typeof FitSchema>;

export const TaskStatusSchema = z.enum(['todo', 'doing', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskDueSchema = z.object({
  text: z.string(),
  hot: z.boolean(),
});
export type TaskDue = z.infer<typeof TaskDueSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().optional(),
  type: TaskTypeSchema,
  fit: FitSchema,
  status: TaskStatusSchema,
  toolId: z.string().optional(),
  prompt: z.string().optional(),
  due: TaskDueSchema.optional(),
  groupId: z.string().optional(),
  saveMin: z.number(),
  fragmentId: z.string(),
  createdAt: z.number(),
  doneAt: z.number().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

/** create_tasks 工具入参用的草稿形状：比 Task 少 id/status/createdAt/doneAt（由 store 生成） */
export const TaskDraftSchema = z.object({
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
export type TaskDraft = z.infer<typeof TaskDraftSchema>;

export const FragmentAttachmentSchema = z.object({
  name: z.string(),
  text: z.string().optional(),
});
export type FragmentAttachment = z.infer<typeof FragmentAttachmentSchema>;

export const FragmentSchema = z.object({
  id: z.string(),
  raw: z.string(),
  attachments: z.array(FragmentAttachmentSchema),
  createdAt: z.number(),
});
export type Fragment = z.infer<typeof FragmentSchema>;

export const GroupKindSchema = z.enum(['urgent', 'project', 'daily']);
export type GroupKind = z.infer<typeof GroupKindSchema>;

export const GroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: GroupKindSchema,
});
export type Group = z.infer<typeof GroupSchema>;

export const SettingsSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string(),
  presetId: z.string(),
  userName: z.string().optional(),
  org: z.string().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ReportKindSchema = z.enum(['daily', 'weekly', 'monthly']);
export type ReportKind = z.infer<typeof ReportKindSchema>;

export const ReportRecordSchema = z.object({
  id: z.string(),
  kind: ReportKindSchema,
  content: z.string(),
  createdAt: z.number(),
});
export type ReportRecord = z.infer<typeof ReportRecordSchema>;

/** 整理官/小派用 link_tasks 记录的任务关联，供「关联横幅」等场景使用（spec §6.2） */
export const RelationSchema = z.object({
  id: z.string(),
  taskIds: z.array(z.string()).min(2),
  reason: z.string(),
  /** 拆解官批量产出关联时附带的行动建议；link_tasks 工具单条记录时没有 */
  suggestion: z.string().optional(),
  createdAt: z.number(),
});
export type Relation = z.infer<typeof RelationSchema>;
