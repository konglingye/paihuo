import { registerLlmBackgroundBridge } from '@/src/llm/background-bridge';
import { eventBus } from '@/src/agents/events';
import { registerDefaultEventRules } from '@/src/agents/eventRules';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useReportsStore } from '@/src/store/reportsStore';
import { useWorklogStore } from '@/src/store/worklogStore';
import { useCaptureStore } from '@/src/store/captureStore';

/** 每天 17:30（arch §5 alarm.eod）：这个上下文（service worker）和 sidepanel 各自有一份 eventBus，规则要各注册一遍 */
const EOD_ALARM_NAME = 'paihuo-eod-check';

/** 右键菜单 id（spec §7） */
const CAPTURE_MENU_ID = 'paihuo-add-selection';

function nextEodTime(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(17, 30, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}

registerDefaultEventRules(eventBus, () => {
  const settings = useSettingsStore.getState().settings;
  return {
    registry: createDefaultToolRegistry(),
    llm: createLlmDriver({ baseUrl: settings.baseUrl, apiKey: settings.apiKey }),
    defaultModel: settings.model,
  };
});

export default defineBackground(() => {
  browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error));

  registerLlmBackgroundBridge();

  browser.alarms.create(EOD_ALARM_NAME, { when: nextEodTime(), periodInMinutes: 24 * 60 });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== EOD_ALARM_NAME) return;
    // service worker 刚醒来时 store 可能还没从 chrome.storage 水合，先确保读到的是最新数据
    await Promise.all([
      useTasksStore.persist.rehydrate(),
      useReportsStore.persist.rehydrate(),
      useWorklogStore.persist.rehydrate(),
    ]);
    await eventBus.emit({ type: 'alarm.eod' });
  });

  // 右键收集（spec §7）：选中文本右键「把选中内容加进派活儿」→ 打开侧边栏、文本进倒活框（不自动拆解）
  browser.contextMenus.create({
    id: CAPTURE_MENU_ID,
    title: '把选中内容加进派活儿',
    contexts: ['selection'],
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CAPTURE_MENU_ID || !info.selectionText || !tab?.windowId) return;
    useCaptureStore.getState().setPendingText(info.selectionText);
    browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => console.error(error));
  });

  // 快捷键（spec §7）：Cmd/Ctrl+Shift+Y 打开面板——sidePanel API 目前没有"关闭"方法，只能做到"唤起"
  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-panel') return;
    const windowId = tab?.windowId;
    if (windowId === undefined) return;
    browser.sidePanel.open({ windowId }).catch((error: unknown) => console.error(error));
  });
});
