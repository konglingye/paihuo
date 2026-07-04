import { useState } from 'react';
import { IconSprite } from '@/src/components/icons/IconSprite';
import { Icon } from '@/src/components/icons/Icon';
import { useUiStore } from '@/src/store';
import { SettingsSheet } from '@/src/components/settings/SettingsSheet';

type TabId = 'overview' | 'jobs' | 'report';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'jobs', label: '活儿' },
  { id: 'report', label: '汇报' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const openSettings = useUiStore((s) => s.openSettings);
  const closeSettings = useUiStore((s) => s.closeSettings);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-50 text-ink">
      <IconSprite />
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
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <div>总览面板占位</div>}
        {activeTab === 'jobs' && <div>活儿面板占位</div>}
        {activeTab === 'report' && <div>汇报面板占位</div>}
      </main>
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
