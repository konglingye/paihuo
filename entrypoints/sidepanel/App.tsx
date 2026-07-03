import { useState } from 'react';

type TabId = 'overview' | 'jobs' | 'report';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'jobs', label: '活儿' },
  { id: 'report', label: '汇报' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-base font-semibold">派活儿</span>
      </header>
      <nav className="flex border-b border-slate-200" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500'
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
    </div>
  );
}

export default App;
