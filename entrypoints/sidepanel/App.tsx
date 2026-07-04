import { useEffect } from 'react';
import { IconSprite } from '@/src/components/icons/IconSprite';
import { Icon } from '@/src/components/icons/Icon';
import { useTasksStore, useUiStore, useWorklogStore } from '@/src/store';
import { SettingsSheet } from '@/src/components/settings/SettingsSheet';
import { DumpPanel } from '@/src/components/dump/DumpPanel';
import { ToastProvider } from '@/src/components/ui';
import { ChatDock } from '@/src/components/chat/ChatDock';
import { ChatSheet } from '@/src/components/chat/ChatSheet';
import { NotifyBridge } from '@/src/components/chat/NotifyBridge';
import { useOrchestratorChat } from '@/src/components/chat/useOrchestratorChat';

type TabId = 'overview' | 'jobs' | 'report';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'jobs', label: '活儿' },
  { id: 'report', label: '汇报' },
];

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
  const chat = useOrchestratorChat();

  // 会话次日归档（arch §3.3）：每次面板打开时检查——如果换了新的一天，把上一个活跃日归档进工作日志
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const tasks = Object.values(useTasksStore.getState().tasks);
    useWorklogStore.getState().archiveIfNewDay(todayKey, tasks);
  }, []);

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
          {activeTab === 'overview' && <div className="p-4">总览面板占位</div>}
          {activeTab === 'jobs' && <DumpPanel />}
          {activeTab === 'report' && <div className="p-4">汇报面板占位</div>}
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
