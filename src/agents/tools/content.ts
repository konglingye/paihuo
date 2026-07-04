import { z } from 'zod';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { TaskTypeSchema, type TaskType } from '@/src/store/schema';
import { findCatalogEntry } from './catalog';
import {
  TASK_TYPE_TEMPLATES,
  composePromptText,
  type PromptTemplateSkeleton,
} from '../prompts/external/taskTypeTemplates';
import type { ToolDefinition } from '../harness/tools';

const CHUNK_SIZE = 2000;

function fullTextOf(fragmentId: string): string {
  const fragment = useFragmentsStore.getState().fragments[fragmentId];
  if (!fragment) throw new Error(`片段不存在：${fragmentId}`);
  const attachmentTexts = fragment.attachments.map((a) => a.text).filter((t): t is string => Boolean(t));
  return [fragment.raw, ...attachmentTexts].join('\n\n');
}

const ReadAttachmentParams = z.object({
  fragmentId: z.string(),
  chunk: z.number().int().min(0).optional(),
});

export interface ReadAttachmentResult {
  chunk: number;
  totalChunks: number;
  hasMore: boolean;
  text: string;
}

/**
 * 分块读取长文档原文，chunk 从 0 开始，不传则返回第 0 块。
 * 长文档由模型自己翻页，避免一次性把全文灌进上下文（arch §3.1「检索优先于灌注」）。
 */
export const readAttachmentTool: ToolDefinition<z.infer<typeof ReadAttachmentParams>, ReadAttachmentResult> = {
  name: 'read_attachment',
  description: '分块读取长文档原文（附件或原始输入），chunk 从 0 开始，不传则返回第 0 块',
  paramsSchema: ReadAttachmentParams,
  effect: 'read',
  handler: ({ fragmentId, chunk = 0 }) => {
    const text = fullTextOf(fragmentId);
    const totalChunks = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));
    if (chunk >= totalChunks) {
      throw new Error(`chunk 超出范围：共 ${totalChunks} 块，请求了第 ${chunk} 块`);
    }
    const start = chunk * CHUNK_SIZE;
    return {
      chunk,
      totalChunks,
      hasMore: chunk < totalChunks - 1,
      text: text.slice(start, start + CHUNK_SIZE),
    };
  },
};

const GetPromptTemplateParams = z.object({
  taskType: TaskTypeSchema,
  toolId: z.string().optional(),
});

function resolvePromptTemplate(taskType: TaskType, toolId?: string): PromptTemplateSkeleton {
  const base = TASK_TYPE_TEMPLATES[taskType];
  const entry = toolId ? findCatalogEntry(toolId) : undefined;
  if (!entry) return base;
  return { ...base, role: `${base.role}（在 ${entry.name} 里作答）` };
}

/** 目录里每个工具×任务类型的模板骨架（角色/任务/格式/语气四段），toolId 不在目录内时优雅降级为通用骨架 */
export const getPromptTemplateTool: ToolDefinition<z.infer<typeof GetPromptTemplateParams>, PromptTemplateSkeleton> = {
  name: 'get_prompt_template',
  description: '按工具+任务类型取外部提示词模板骨架（角色/任务/格式/语气四段）',
  paramsSchema: GetPromptTemplateParams,
  effect: 'read',
  handler: ({ taskType, toolId }) => resolvePromptTemplate(taskType, toolId),
};

const DraftUserPromptParams = z.object({
  taskId: z.string(),
  /** 有信息就填对应段落，模型不知道的段落留默认骨架里的【…】空槽 */
  slots: z
    .object({
      role: z.string().optional(),
      task: z.string().optional(),
      format: z.string().optional(),
      tone: z.string().optional(),
    })
    .optional(),
});

/** 给指定任务生成交付给用户的外部提示词；用户必须补的信息一律保留【…】空槽 */
export const draftUserPromptTool: ToolDefinition<z.infer<typeof DraftUserPromptParams>, { prompt: string }> = {
  name: 'draft_user_prompt',
  description: '给指定任务生成交付给用户的外部提示词，slots 里没给的段落保留模板默认的【…】空槽',
  paramsSchema: DraftUserPromptParams,
  effect: 'read',
  handler: ({ taskId, slots }) => {
    const task = useTasksStore.getState().tasks[taskId];
    if (!task) throw new Error(`任务不存在：${taskId}`);
    const base = resolvePromptTemplate(task.type, task.toolId);
    const filled: PromptTemplateSkeleton = { ...base, ...slots };
    return { prompt: composePromptText(filled) };
  },
};

const DraftMessageParams = z.object({
  kind: z.enum(['nudge', 'howto', 'direct']),
  context: z.object({
    taskTitle: z.string().optional(),
    recipient: z.string().optional(),
    detail: z.string().optional(),
  }),
});

/** 「小抄」：可直接发送的消息草稿（催办/教做法 3 步/直接可发的话术） */
export const draftMessageTool: ToolDefinition<z.infer<typeof DraftMessageParams>, { message: string }> = {
  name: 'draft_message',
  description: '生成可以直接发送的小抄消息（催办/教做法/直接可发的话术）',
  paramsSchema: DraftMessageParams,
  effect: 'read',
  handler: ({ kind, context }) => {
    if (kind === 'nudge') {
      return {
        message: `${context.recipient ?? '您'}好，「${context.taskTitle ?? '这件事'}」想麻烦问一下进展，${context.detail ?? '方便的话尽快回复一下'}，谢谢！`,
      };
    }
    if (kind === 'howto') {
      return {
        message: `教你 3 步搞定「${context.taskTitle ?? '这件事'}」：\n1. ${context.detail ?? '先明确目标和素材'}\n2. 用合适的 AI 工具起草\n3. 检查一遍再交付`,
      };
    }
    return { message: context.detail ?? `关于「${context.taskTitle ?? '这件事'}」，我这边已经处理好了。` };
  },
};
