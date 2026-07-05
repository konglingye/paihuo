import { useEffect, useState } from 'react';
import { Button, Pill, Sheet } from '@/src/components/ui';
import { cn } from '@/src/lib/cn';
import { FIT_LABELS, TYPE_LABELS } from '@/src/components/tasks/taskTypeMeta';
import type { DecomposerOutput } from '@/src/agents/profiles/decomposer';

export interface DecomposeConfirmSheetProps {
  open: boolean;
  output: DecomposerOutput | null;
  onConfirm: (filledOutput: DecomposerOutput) => void;
  onCancel: () => void;
}

interface DueDraft {
  text: string;
  /** 用户主动勾了"不用填"，就算没填字也不拦确认 */
  skip: boolean;
}

function draftsFromOutput(output: DecomposerOutput | null): DueDraft[] {
  return (output?.tasks ?? []).map((t) => ({ text: t.due?.text ?? '', skip: false }));
}

/**
 * 拆解完不直接落库，先弹这个确认弹窗过一遍——用户要求的交互：AI 识别出的截止时间预填，
 * 没识别出来的要么手动补、要么明确勾"不用填"，都处理过一遍才真正创建任务卡。
 * 只读展示标题/fit/类型，不在这一步改这些——那些落库后去任务卡展开区正常编辑。
 */
export function DecomposeConfirmSheet({ open, output, onConfirm, onCancel }: DecomposeConfirmSheetProps) {
  const [drafts, setDrafts] = useState<DueDraft[]>(() => draftsFromOutput(output));

  // 每次换一批新的待确认输出（新的一次拆解）都要重新起草，不能沿用上一批的草稿
  useEffect(() => {
    setDrafts(draftsFromOutput(output));
  }, [output]);

  const tasks = output?.tasks ?? [];
  const unresolvedIndex = tasks.findIndex((_, i) => !drafts[i]?.text.trim() && !drafts[i]?.skip);
  const canConfirm = tasks.length > 0 && unresolvedIndex === -1;

  function updateDraft(index: number, patch: Partial<DueDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleConfirm() {
    if (!output || !canConfirm) return;
    const filled: DecomposerOutput = {
      ...output,
      tasks: output.tasks.map((t, i) => {
        const draft = drafts[i];
        const text = draft?.text.trim();
        return { ...t, due: text ? { text, hot: t.due?.hot ?? false } : undefined };
      }),
    };
    onConfirm(filled);
  }

  return (
    <Sheet
      open={open && !!output}
      onClose={onCancel}
      title={`确认这 ${tasks.length} 件活儿`}
      heightClassName="max-h-[calc(100%-96px)]"
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          <p className="text-[12px] leading-relaxed text-sub">
            再看一眼，截止时间记得填——AI 识别出来的已经帮你填好，没识别出来的补一下，实在没有就勾"不用填"。
          </p>
          {tasks.map((t, i) => {
            const draft = drafts[i] ?? { text: '', skip: false };
            const needsAttention = !draft.text.trim() && !draft.skip;
            return (
              <div
                key={i}
                className={cn(
                  'rounded-xl border p-3',
                  needsAttention ? 'border-[rgba(245,84,75,.35)] bg-red-soft' : 'border-hairsoft bg-white',
                )}
              >
                <div className="mb-1.5 text-[13px] font-semibold leading-snug text-ink">{t.title}</div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Pill variant={`fit-${t.fit}`}>{FIT_LABELS[t.fit]}</Pill>
                  <span className="rounded-full border border-hairsoft px-2 py-0.5 text-[10.5px] text-faint">
                    {TYPE_LABELS[t.type]}
                  </span>
                  {t.due?.text && <span className="text-[10.5px] text-accent-ink">AI 识别到「{t.due.text}」</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`${t.title} 截止时间`}
                    placeholder="这件事儿啥时候要？"
                    value={draft.text}
                    disabled={draft.skip}
                    onChange={(e) => updateDraft(i, { text: e.target.value })}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-hairsoft bg-white px-2 text-[12px] text-ink outline-none focus:border-[rgba(61,111,252,.45)] disabled:opacity-50"
                  />
                  <label className="flex flex-none items-center gap-1 text-[11px] text-sub">
                    <input
                      type="checkbox"
                      aria-label={`${t.title} 不用填截止时间`}
                      checked={draft.skip}
                      onChange={(e) => updateDraft(i, { skip: e.target.checked })}
                    />
                    不用填
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-none gap-2 border-t border-hairsoft p-3">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" size="sm" className="flex-1" disabled={!canConfirm} onClick={handleConfirm}>
            确认创建 {tasks.length} 件活儿
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
