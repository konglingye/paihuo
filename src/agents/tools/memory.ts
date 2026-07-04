import { z } from 'zod';
import { useMemoryStore } from '@/src/store/memoryStore';
import type { ToolDefinition } from '../harness/tools';

const RememberParams = z.object({ fact: z.string() });

/** 记一条关于用户的事实（称呼/部门/工具偏好/纠正记录），下次对话的记忆块会自动带上（arch §3.3） */
export const rememberTool: ToolDefinition<z.infer<typeof RememberParams>> = {
  name: 'remember',
  description: '记住一条关于用户的事实（称呼/部门/工具偏好/纠正记录），下次对话会自动带上',
  paramsSchema: RememberParams,
  effect: 'write',
  handler: ({ fact }) => {
    useMemoryStore.getState().remember(fact);
    return { remembered: true };
  },
};

const RecallParams = z.object({ topic: z.string().optional() });

/** 回忆已知的用户事实，可选按关键词过滤；命中的事实顺带标记为最近使用，减缓被淘汰 */
export const recallTool: ToolDefinition<z.infer<typeof RecallParams>> = {
  name: 'recall',
  description: '回忆关于用户的已知事实，可选按关键词过滤',
  paramsSchema: RecallParams,
  effect: 'read',
  handler: ({ topic }) => ({ facts: useMemoryStore.getState().recall(topic) }),
};

export const memoryTools: ToolDefinition[] = [rememberTool, recallTool];
