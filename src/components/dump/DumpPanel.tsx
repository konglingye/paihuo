import { useEffect, useState } from 'react';
import { Icon } from '@/src/components/icons/Icon';
import { AttachButton } from '@/src/components/attachments/AttachButton';
import { TaskCard } from '@/src/components/tasks/TaskCard';
import { useToast } from '@/src/components/ui';
import { useFragmentsStore, useTasksStore } from '@/src/store';
import { findCatalogEntry } from '@/src/agents/tools/catalog';
import { DECOMPOSER_SAMPLE_INPUT } from '@/src/mocks/llm/fixtures';
import { useDecomposeRun } from './useDecomposeRun';
import type { FragmentAttachment } from '@/src/store/schema';

const THINKING_TEXT: Record<'reading' | 'drafting', string> = {
  reading: '正在读你贴的内容…',
  drafting: '正在拆解成任务…',
};

function SkeletonCard() {
  return (
    <div className="mb-2 animate-pulse rounded-card border border-hairsoft bg-white p-3.5">
      <div className="mb-2 h-[11px] w-3/4 rounded bg-black/[.06]" />
      <div className="h-[11px] w-1/2 rounded bg-black/[.06]" />
    </div>
  );
}

function AnimatedEntry({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return (
    <div className={`transition-all duration-300 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
      {children}
    </div>
  );
}

export function DumpPanel() {
  const [dumpText, setDumpText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<FragmentAttachment[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [justAddedIds, setJustAddedIds] = useState<string[]>([]);
  const { phase, error, run } = useDecomposeRun();
  const { show } = useToast();

  const tasks = useTasksStore((s) => s.tasks);
  const addFragment = useFragmentsStore((s) => s.addFragment);

  const busy = phase === 'reading' || phase === 'drafting';

  useEffect(() => {
    if (phase === 'error' && error) show(error);
  }, [phase, error, show]);

  async function handleDecompose(text: string) {
    if (!text.trim() && pendingAttachments.length === 0) return;
    const fragment = addFragment({ raw: text, attachments: pendingAttachments });
    const before = new Set(Object.keys(useTasksStore.getState().tasks));
    await run(fragment);
    const after = Object.keys(useTasksStore.getState().tasks);
    setJustAddedIds(after.filter((id) => !before.has(id)));
    setDumpText('');
    setPendingAttachments([]);
    setCollapsed(true);
  }

  const taskIds = Object.keys(tasks);

  return (
    <div>
      {!collapsed ? (
        <div className="p-3.5 pb-1">
          <div className="rounded-2xl border border-hairsoft bg-white p-3 shadow-card focus-within:border-[rgba(61,111,252,.45)] focus-within:shadow-[0_0_0_3.5px_rgba(61,111,252,.1)]">
            <textarea
              rows={3}
              aria-label="任务输入"
              placeholder="把活儿倒给我——领导原话、会议记录、随手一句都行；pdf、word、截图直接拖或粘贴"
              value={dumpText}
              disabled={busy}
              onChange={(e) => setDumpText(e.target.value)}
              className="w-full resize-none border-none bg-transparent text-[13px] leading-relaxed text-ink outline-none placeholder:text-faint"
            />
            {pendingAttachments.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pendingAttachments.map((a) => (
                  <span
                    key={a.name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairsoft bg-wash px-2 py-1 text-[11.5px] text-sub"
                  >
                    <Icon name="clip" className="h-3 w-3 text-accent-ink" />
                    {a.name}
                    <button
                      type="button"
                      aria-label={`移除 ${a.name}`}
                      onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.name !== a.name))}
                      className="text-faint hover:text-red"
                    >
                      <Icon name="x" className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDumpText(DECOMPOSER_SAMPLE_INPUT)}
                className="rounded px-0.5 text-[12px] text-accent-ink hover:underline"
              >
                试试示例 →
              </button>
              <AttachButton
                onFile={({ name, parsed }) =>
                  setPendingAttachments((prev) => [...prev, { name, text: parsed.isImage ? undefined : parsed.text }])
                }
              />
              <button
                type="button"
                aria-label="语音输入"
                onClick={() => show('语音输入下个版本见')}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sub hover:bg-gray-soft hover:text-ink"
              >
                <Icon name="mic" />
              </button>
              <button
                type="button"
                disabled={busy || (!dumpText.trim() && pendingAttachments.length === 0)}
                onClick={() => handleDecompose(dumpText)}
                className="btn-gradient ml-auto flex h-[30px] items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
              >
                <Icon name="spark" className="h-3.5 w-3.5" />
                拆解
              </button>
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-2 px-1 pt-2.5 text-[12.5px] font-semibold">
              <span className="flex gap-[3px]">
                <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:0ms]" />
                <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:150ms]" />
                <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:300ms]" />
              </span>
              <span
                className="bg-[linear-gradient(90deg,#3D6FFC_20%,#9CBAFF_42%,#3D6FFC_62%)] bg-[length:200%_100%] bg-clip-text text-transparent"
                style={{ animation: 'aiflow 2.2s linear infinite' }}
              >
                {THINKING_TEXT[phase as 'reading' | 'drafting']}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 pb-1">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-hair bg-wash px-3 py-2 text-[12.5px] text-sub hover:border-[rgba(61,111,252,.4)] hover:text-accent-ink"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            再倒点活儿进来
          </button>
        </div>
      )}

      <div className="p-3.5 pt-2.5">
        {busy && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {taskIds.map((id) => (
          <AnimatedEntry key={id} delayMs={justAddedIds.includes(id) ? justAddedIds.indexOf(id) * 70 : 0}>
            <TaskCard
              taskId={id}
              toolName={tasks[id].toolId ? findCatalogEntry(tasks[id].toolId!)?.name : undefined}
              toolUrl={tasks[id].toolId ? findCatalogEntry(tasks[id].toolId!)?.url : undefined}
            />
          </AnimatedEntry>
        ))}
        {taskIds.length === 0 && !busy && (
          <p className="mt-3 rounded-xl border border-dashed border-hair bg-wash px-3 py-2.5 text-[12.5px] text-faint">
            还没有活儿——倒一段试试，或点上面「试试示例」
          </p>
        )}
      </div>
    </div>
  );
}
