import { ToolRegistry } from './harness/tools';
import { taskTools } from './tools/tasks';
import { searchToolCatalogTool } from './tools/catalog';
import { draftMessageTool, draftUserPromptTool, getPromptTemplateTool, readAttachmentTool } from './tools/content';
import { uiTools } from './tools/ui';
import { memoryTools } from './tools/memory';
import { createDispatchTool, type DispatchToolDeps } from './tools/dispatch';

/**
 * 汇总当前已落地的全部工具；新工具落地后加进这里就对所有 profile 可见（各 profile 仍按 toolNames 白名单过滤）。
 * dispatch 是个例外：它需要绑定"当前这次 run 用的 llm/defaultModel"才能递归调用子代理，
 * 所以只有传了 dispatchDeps（小派聊天场景）才会注册；decompose/organize 等单次调用不需要它。
 */
export function createDefaultToolRegistry(dispatchDeps?: Omit<DispatchToolDeps, 'registry'>): ToolRegistry {
  const registry = new ToolRegistry();
  [
    ...taskTools,
    searchToolCatalogTool,
    readAttachmentTool,
    getPromptTemplateTool,
    draftUserPromptTool,
    draftMessageTool,
    ...uiTools,
    ...memoryTools,
  ].forEach((tool) => registry.register(tool));
  if (dispatchDeps) {
    registry.register(createDispatchTool({ registry, ...dispatchDeps }));
  }
  return registry;
}
