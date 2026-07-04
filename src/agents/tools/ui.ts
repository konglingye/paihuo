import { z } from 'zod';
import { browser } from 'wxt/browser';
import { useTasksStore } from '@/src/store/tasksStore';
import { useUiStore } from '@/src/store/uiStore';
import { findCatalogEntry } from './catalog';
import type { ToolDefinition } from '../harness/tools';

const RevealCardParams = z.object({ taskId: z.string() });

/** 带用户跳到活儿 tab 并高亮指定卡片（arch §2 UI 工具，effect=ui，需 allowUiExternal） */
export const revealCardTool: ToolDefinition<z.infer<typeof RevealCardParams>> = {
  name: 'reveal_card',
  description: '带用户跳到活儿 tab 并高亮指定的任务卡',
  paramsSchema: RevealCardParams,
  effect: 'ui',
  handler: ({ taskId }) => {
    if (!useTasksStore.getState().tasks[taskId]) throw new Error(`任务不存在：${taskId}`);
    useUiStore.getState().revealTask(taskId);
    return { taskId };
  },
};

const NotifyParams = z.object({ text: z.string() });

/** 弹一条 toast 提醒；handler 只落 uiStore 状态，真正渲染由 NotifyBridge 组件桥接（工具层没有 React context） */
export const notifyTool: ToolDefinition<z.infer<typeof NotifyParams>> = {
  name: 'notify',
  description: '给用户弹一条简短提醒',
  paramsSchema: NotifyParams,
  effect: 'ui',
  handler: ({ text }) => {
    useUiStore.getState().notify(text);
    return { notified: true };
  },
};

const OpenToolSiteParams = z.object({
  toolId: z.string(),
  /** 有内容就先复制到剪贴板再开标签（对应 arch"复制+开标签"），不传就只开标签 */
  textToCopy: z.string().optional(),
});

/** 打开封闭目录里某个工具的官网标签页，可选先复制一段文本（提示词/小抄） */
export const openToolSiteTool: ToolDefinition<z.infer<typeof OpenToolSiteParams>> = {
  name: 'open_tool_site',
  description: '复制一段文本（可选）并打开目录里某个工具的官网标签页',
  paramsSchema: OpenToolSiteParams,
  effect: 'ui',
  handler: async ({ toolId, textToCopy }) => {
    const entry = findCatalogEntry(toolId);
    if (!entry) throw new Error(`工具目录里没有这个 id：${toolId}`);
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {
        // 剪贴板权限在部分环境不可用，忽略——不影响打开标签页
      }
    }
    await browser.tabs.create({ url: entry.url }).catch(() => {});
    return { opened: true, url: entry.url, name: entry.name };
  },
};

export const uiTools: ToolDefinition[] = [revealCardTool, notifyTool, openToolSiteTool];
