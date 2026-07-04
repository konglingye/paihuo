import { useState } from 'react';
import { IconSprite } from '@/src/components/icons/IconSprite';
import { Icon, type IconName } from '@/src/components/icons/Icon';
import { Button, Pill, Chip, Card, SegmentedTabs, Sheet, ToastProvider, useToast, ProgressRing } from '@/src/components/ui';
import { AttachButton } from '@/src/components/attachments/AttachButton';
import { useFragmentsStore } from '@/src/store';

const ICON_NAMES: IconName[] = [
  'plane', 'sliders', 'mic', 'clip', 'copy', 'ext', 'check', 'chev', 'clock', 'spark',
  'link', 'msg', 'x', 'plus', 'arr', 'reset', 'zap', 'lock', 'inbox', 'note', 'grid',
  'dl', 'img', 'user',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-faint">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <Button variant="secondary" onClick={() => show('提示词已复制 — 粘贴到 DeepSeek 就能用')}>
      触发 toast
    </Button>
  );
}

function AttachButtonDemo() {
  const fragments = useFragmentsStore((s) => s.fragments);
  return (
    <div className="relative flex h-[200px] w-[404px] flex-col gap-2 overflow-hidden rounded-panel border border-hairsoft bg-white p-4 shadow-panel">
      <div className="flex items-center gap-2">
        <AttachButton />
        <span className="text-[12px] text-sub">试试传 .exe（被拒）或 .txt/.pdf/.docx/.xlsx（真实解析）</span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto text-[11.5px] text-sub">
        {Object.values(fragments).map((f) => (
          <div key={f.id} className="rounded-lg bg-wash px-2 py-1">
            {f.attachments[0]?.name}：{f.raw.slice(0, 40)}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-ink">
      <IconSprite />
      <h1 className="mb-8 text-lg font-bold">派活儿 · 基础组件展示（dev only）</h1>

      <Section title="Icon">
        {ICON_NAMES.map((name) => (
          <div key={name} className="flex w-16 flex-col items-center gap-1 text-[10px] text-sub">
            <Icon name={name} className="h-5 w-5" />
            {name}
          </div>
        ))}
      </Section>

      <Section title="Button">
        <Button variant="primary">复制提示词 · 打开工具</Button>
        <Button variant="secondary">标记完成</Button>
        <Button variant="success">
          <Icon name="check" />
          已复制
        </Button>
      </Section>

      <Section title="Pill">
        <Pill variant="due" icon={<Icon name="clock" />}>下周一</Pill>
        <Pill variant="due-hot" icon={<Icon name="clock" />}>今天 18:00</Pill>
        <Pill variant="fit-full">AI 可代劳</Pill>
        <Pill variant="fit-assist">AI 打下手</Pill>
        <Pill variant="fit-self">自己来 · 有小抄</Pill>
      </Section>

      <Section title="Chip">
        <Chip active>全部</Chip>
        <Chip count={4}>写作</Chip>
        <Chip count={2}>演示</Chip>
      </Section>

      <Section title="Card">
        <Card className="w-80 p-4">
          <div className="text-[13.5px] font-semibold">整理今天的会议纪要，下班前发群里</div>
          <div className="mt-2 flex gap-1.5">
            <Pill variant="due-hot" icon={<Icon name="clock" />}>今天 18:00</Pill>
            <Pill variant="fit-full">AI 可代劳</Pill>
          </div>
        </Card>
      </Section>

      <Section title="SegmentedTabs">
        <SegmentedTabs
          className="w-64"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'a', label: '总览' },
            { value: 'b', label: '活儿' },
            { value: 'c', label: '汇报' },
          ]}
        />
      </Section>

      <Section title="ProgressRing">
        <ProgressRing done={0} total={0} />
        <ProgressRing done={1} total={4} />
        <ProgressRing done={4} total={4} />
      </Section>

      <Section title="Sheet / Toast（面板容器内演示）">
        <ToastProvider>
          <div className="relative h-[600px] w-[404px] overflow-hidden rounded-panel border border-hairsoft bg-white shadow-panel">
            <div className="flex items-center gap-3 p-4">
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                打开 sheet
              </Button>
              <ToastDemo />
            </div>
            <Sheet
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              title="小派"
              statusText="在线"
              heightClassName="h-[76%]"
            >
              <div className="p-4 text-[13px] text-sub">对话内容占位</div>
            </Sheet>
          </div>
        </ToastProvider>
      </Section>

      <Section title="AttachButton（附件白名单）">
        <ToastProvider>
          <AttachButtonDemo />
        </ToastProvider>
      </Section>
    </div>
  );
}

export default App;
