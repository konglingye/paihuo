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

function matchScore(entry: ToolCatalogEntry, query: string): number {
  let score = 0;
  if (entry.name.toLowerCase().includes(query)) score += 2;
  if (entry.strengths.toLowerCase().includes(query)) score += 1;
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
