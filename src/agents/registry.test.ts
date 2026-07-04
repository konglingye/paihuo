import { describe, expect, it } from 'vitest';
import { createDefaultToolRegistry } from './registry';

describe('createDefaultToolRegistry', () => {
  it('注册当前全部已落地的工具，且不重复报错', () => {
    const registry = createDefaultToolRegistry();
    const names = registry.list().map((t) => t.name);
    expect(names.sort()).toEqual(
      [
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
      ].sort(),
    );
  });
});
