import { registerLlmBackgroundBridge } from '@/src/llm/background-bridge';
import { eventBus } from '@/src/agents/events';
import { registerDefaultEventRules } from '@/src/agents/eventRules';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useReportsStore } from '@/src/store/reportsStore';
import { useWorklogStore } from '@/src/store/worklogStore';

/** 每天 17:30（arch §5 alarm.eod）：这个上下文（service worker）和 sidepanel 各自有一份 eventBus，规则要各注册一遍 */
const EOD_ALARM_NAME = 'paihuo-eod-check';

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
});
