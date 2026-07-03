import { ToolRegistry } from './harness/tools';
import { taskTools } from './tools/tasks';
import { searchToolCatalogTool } from './tools/catalog';
import { readAttachmentTool } from './tools/content';

/** 汇总当前已落地的全部工具；新工具落地后加进这里就对所有 profile 可见（各 profile 仍按 toolNames 白名单过滤） */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  [...taskTools, searchToolCatalogTool, readAttachmentTool].forEach((tool) => registry.register(tool));
  return registry;
}
