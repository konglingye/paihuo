import { z } from 'zod';
import toolCatalogData from '@/src/assets/tools.json';
import { TaskTypeSchema } from '@/src/store/schema';
import type { ToolDefinition } from '../harness/tools';

/**
 * 封闭工具目录（spec §5）。当前只落了种子数据，完整的 16 项清单 + URL 核验脚本在 T12 补齐。
 * search_tool_catalog 只能从这里选，杜绝幻觉链接。
 */
export const ToolCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  registerNote: z.string(),
  categories: z.array(TaskTypeSchema),
  strengths: z.string(),
  priceNote: z.string(),
});
export type ToolCatalogEntry = z.infer<typeof ToolCatalogEntrySchema>;

const TOOL_CATALOG: ToolCatalogEntry[] = ToolCatalogEntrySchema.array().parse(toolCatalogData);

export function findCatalogEntry(toolId: string): ToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((entry) => entry.id === toolId);
}

/**
 * 真模型发的是自然语言短句（如"PPT 渠道政策 经销商 发布会"），不是单个关键词——
 * 按整句去匹配 name/strengths 这种短字段几乎不可能命中，T24 真 key 冒烟时实测
 * search_tool_catalog 对每次真实调用都返回空数组，直接导致 fit 全线降级成 self。
 * 改成按词切开、任一词命中就计分。
 */
function matchScore(entry: ToolCatalogEntry, query: string): number {
  const terms = query.split(/[\s,，、]+/).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (entry.name.toLowerCase().includes(term)) score += 2;
    if (entry.strengths.toLowerCase().includes(term)) score += 1;
  }
  return score;
}

const SearchToolCatalogParams = z.object({
  query: z.string(),
  taskType: TaskTypeSchema.optional(),
});

export const searchToolCatalogTool: ToolDefinition<z.infer<typeof SearchToolCatalogParams>, ToolCatalogEntry[]> = {
  name: 'search_tool_catalog',
  description: '在封闭工具目录内按关键词/任务类型检索可用工具，禁止编造目录之外的工具',
  paramsSchema: SearchToolCatalogParams,
  effect: 'read',
  handler: ({ query, taskType }) => {
    const candidates = taskType ? TOOL_CATALOG.filter((entry) => entry.categories.includes(taskType)) : TOOL_CATALOG;
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates
      .map((entry) => ({ entry, score: matchScore(entry, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);
  },
};
