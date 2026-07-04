import { describe, expect, it } from 'vitest';
import { searchToolCatalogTool, ToolCatalogEntrySchema } from './catalog';
import toolCatalogData from '@/src/assets/tools.json';

describe('search_tool_catalog', () => {
  it('种子目录本身满足 ToolCatalogEntrySchema（封闭目录，禁止幻觉字段）', () => {
    const parsed = ToolCatalogEntrySchema.array().safeParse(toolCatalogData);
    expect(parsed.success).toBe(true);
  });

  it('schema 拒绝缺少 query 的调用', () => {
    const parsed = searchToolCatalogTool.paramsSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('按 taskType 过滤，只返回目录内覆盖该类型的工具', async () => {
    const result = await searchToolCatalogTool.handler({ query: '', taskType: 'slide' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((entry) => entry.categories.includes('slide'))).toBe(true);
  });

  it('按关键词匹配名字/长处，命中的排在前面，没命中的不出现', async () => {
    const result = await searchToolCatalogTool.handler({ query: 'PPT' });
    expect(result.map((entry) => entry.id)).toContain('gamma');
    expect(result.every((entry) => entry.name.toLowerCase().includes('ppt') || entry.strengths.toLowerCase().includes('ppt'))).toBe(true);
  });

  it('查不到任何东西时返回空数组而不是抛错', async () => {
    const result = await searchToolCatalogTool.handler({ query: '不存在的东西', taskType: 'comm' });
    expect(result).toEqual([]);
  });

  it('结果只可能来自封闭目录内的 id，不会凭空产出目录之外的工具', async () => {
    const result = await searchToolCatalogTool.handler({ query: '' });
    const catalogIds = new Set((toolCatalogData as { id: string }[]).map((t) => t.id));
    expect(result.every((entry) => catalogIds.has(entry.id))).toBe(true);
  });
});
