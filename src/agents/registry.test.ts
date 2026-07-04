import { describe, expect, it } from 'vitest';
import { createDefaultToolRegistry } from './registry';

const BASE_TOOL_NAMES = [
  'list_tasks',
  'get_task',
  'create_tasks',
  'update_task',
  'complete_task',
  'group_tasks',
  'link_tasks',
  'search_tool_catalog',
  'read_attachment',
  'get_prompt_template',
  'draft_user_prompt',
  'draft_message',
  'reveal_card',
  'notify',
  'open_tool_site',
];

describe('createDefaultToolRegistry', () => {
  it('注册当前全部已落地的工具，且不重复报错', () => {
    const registry = createDefaultToolRegistry();
    const names = registry.list().map((t) => t.name);
    expect(names.sort()).toEqual([...BASE_TOOL_NAMES].sort());
  });

  it('传了 dispatchDeps 才额外注册 dispatch（不影响 decompose/organize 等不需要它的调用方）', () => {
    const registry = createDefaultToolRegistry({ llm: async () => ({ text: '', toolCalls: [] }), defaultModel: 'mock' });
    const names = registry.list().map((t) => t.name);
    expect(names.sort()).toEqual([...BASE_TOOL_NAMES, 'dispatch'].sort());
  });
});
