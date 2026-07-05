import { useEffect, useRef } from 'react';
import { IconSprite } from '@/src/components/icons/IconSprite';
import { Icon } from '@/src/components/icons/Icon';
import { useCaptureStore, useSettingsStore, useTasksStore, useUiStore, useWorklogStore } from '@/src/store';
import { SettingsSheet } from '@/src/components/settings/SettingsSheet';
import { DumpPanel } from '@/src/components/dump/DumpPanel';
import { OverviewPanel } from '@/src/components/overview/OverviewPanel';
import { ReportPanel } from '@/src/components/report/ReportPanel';
import { ToastProvider } from '@/src/components/ui';
import { ChatDock } from '@/src/components/chat/ChatDock';
import { ChatSheet } from '@/src/components/chat/ChatSheet';
import { NotifyBridge } from '@/src/components/chat/NotifyBridge';
import { useOrchestratorChat } from '@/src/components/chat/useOrchestratorChat';
import { eventBus } from '@/src/agents/events';
import { registerDefaultEventRules } from '@/src/agents/eventRules';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';

type TabId = 'overview' | 'jobs' | 'report';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'jobs', label: '活儿' },
  { id: 'report', label: '汇报' },
];

// 模块顶层只跑一次（arch §5）：dump.created / task.completed 这两条规则在 sidepanel 上下文里生效
registerDefaultEventRules(eventBus, () => {
  const settings = useSettingsStore.getState().settings;
  return {
    registry: createDefaultToolRegistry(),
    llm: createLlmDriver({ baseUrl: settings.baseUrl, apiKey: settings.apiKey }),
    defaultModel: settings.model,
  };
});

function App() {
  // activeTab 挂在 uiStore 而不是本地 state：reveal_card 工具需要从组件树外部切 tab（T14）
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const openSettings = useUiStore((s) => s.openSettings);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const chatOpen = useUiStore((s) => s.chatOpen);
  const openChat = useUiStore((s) => s.openChat);
  const closeChat = useUiStore((s) => s.closeChat);
  const pendingChatPrompt = useUiStore((s) => s.pendingChatPrompt);
  const chat = useOrchestratorChat();
  const lastPromptNonce = useRef(0);

  // 关联横幅「好，先定关键信息」等场景的桥接：那些地方拿不到这里的 chat.send（只在 App 顶层
  // 实例化），只能落 uiStore 的一次性信号，这里接住并真正发给小派——不然点了按钮只是打开一个
  // 空对话框，没人说话（真实反馈的 bug）。
  useEffect(() => {
    if (pendingChatPrompt && pendingChatPrompt.nonce !== lastPromptNonce.current) {
      lastPromptNonce.current = pendingChatPrompt.nonce;
      openChat();
      void chat.send(pendingChatPrompt.text);
    }
  }, [pendingChatPrompt, openChat, chat.send]);

  // 会话次日归档（arch §3.3）：每次面板打开时检查——如果换了新的一天，把上一个活跃日归档进工作日志
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const tasks = Object.values(useTasksStore.getState().tasks);
    useWorklogStore.getState().archiveIfNewDay(todayKey, tasks);

    // alarm.eod 提醒（arch §5）：后台闹钟触发时面板可能是关着的，开面板时把攒下的提醒转成 toast
    const { eodNudgeDate, dismissEodNudge } = useWorklogStore.getState();
    if (eodNudgeDate) {
      useUiStore.getState().notify('今天完成了一些活儿，要不要顺手写个日报？');
      dismissEodNudge();
    }

    // 右键收集（spec §7）：background 写进 chrome.storage 的选中文本可能比这次挂载还新，先水合一下再看
    void Promise.resolve(useCaptureStore.persist.rehydrate()).then(() => {
      if (useCaptureStore.getState().pendingText) setActiveTab('jobs');
    });
  }, [setActiveTab]);

  return (
    <ToastProvider>
      <div className="relative flex h-screen flex-col overflow-hidden bg-slate-50 text-ink">
        <IconSprite />
        <NotifyBridge />
        <header className="flex items-center justify-between border-b border-hairsoft px-4 py-3">
          <span className="text-base font-semibold">派活儿</span>
          <button
            type="button"
            aria-label="设置"
            onClick={openSettings}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sub hover:bg-gray-soft hover:text-ink"
          >
            <Icon name="sliders" />
          </button>
        </header>
        <nav className="flex border-b border-hairsoft" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex-1 py-2 text-sm font-medium ${
                activeTab === tab.id ? 'border-b-2 border-accent text-accent-ink' : 'text-sub'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <main className={`flex-1 overflow-y-auto ${activeTab !== 'report' ? 'pb-24' : ''}`}>
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'jobs' && <DumpPanel />}
          {activeTab === 'report' && <ReportPanel />}
        </main>
        {activeTab !== 'report' && (
          <ChatDock busy={chat.busy} onSend={(text) => { openChat(); void chat.send(text); }} />
        )}
        <ChatSheet
          open={chatOpen}
          onClose={closeChat}
          messages={chat.messages}
          busy={chat.busy}
          activity={chat.activity}
          onSend={(text, attachment) => void chat.send(text, attachment)}
        />
        <SettingsSheet open={settingsOpen} onClose={closeSettings} />
      </div>
    </ToastProvider>
  );
}

export default App;
