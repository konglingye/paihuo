import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Icon } from '@/src/components/icons/Icon';
import { Pill, Button, useToast } from '@/src/components/ui';
import { useTasksStore, useUiStore } from '@/src/store';
import { cn } from '@/src/lib/cn';
import { TYPE_LABELS } from './taskTypeMeta';
import type { Task } from '@/src/store/schema';

const FIT_LABELS: Record<Task['fit'], string> = {
  full: 'AI 可代劳',
  assist: 'AI 打下手',
  self: '自己来 · 有小抄',
};

const COPIED_STATE_MS = 2600;
const BURST_PARTICLES = 6;
const BURST_RADIUS_PX = 22;
const BURST_DURATION_MS = 600;
const FLASH_DURATION_MS = 1800;

/** 用户必须补的信息一律写成【…】空槽，这里渲染成高亮 mark（原型 .slot） */
function renderPromptWithSlots(text: string) {
  return text.split(/(【[^】]*】)/g).map((part, i) =>
    part.startsWith('【') && part.endsWith('】') ? (
      <mark key={i} className="rounded bg-[#FBF3E0] px-0.5 font-medium text-[#8F6710]">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** 完成时的粒子动效（原型 .spark-burst）：临时插入几个 span，动画结束后自行移除 */
function burstFrom(container: HTMLElement, originEl: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const originRect = originEl.getBoundingClientRect();
  const x = originRect.left - containerRect.left + originRect.width / 2;
  const y = originRect.top - containerRect.top + originRect.height / 2;

  for (let i = 0; i < BURST_PARTICLES; i++) {
    const angle = (i / BURST_PARTICLES) * Math.PI * 2 + 0.4;
    const span = document.createElement('span');
    span.style.cssText = [
      'position:absolute',
      'width:5px',
      'height:5px',
      'border-radius:50%',
      'background:var(--color-ok)',
      'pointer-events:none',
      'z-index:30',
      `left:${x}px`,
      `top:${y}px`,
      `--dx:${Math.cos(angle) * BURST_RADIUS_PX}px`,
      `--dy:${Math.sin(angle) * BURST_RADIUS_PX}px`,
      'animation:burst .55s ease-out forwards',
    ].join(';');
    container.appendChild(span);
    setTimeout(() => span.remove(), BURST_DURATION_MS);
  }
}

export interface TaskCardProps {
  taskId: string;
  toolName?: string;
  toolUrl?: string;
}

/** 任务卡：对应原型 .card，逐张入场动效由列表容器负责，这里只管自身的展开/收起与操作 */
export function TaskCard({ taskId, toolName, toolUrl }: TaskCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const task = useTasksStore((s) => s.tasks[taskId]);
  const completeTask = useTasksStore((s) => s.completeTask);
  const removeTask = useTasksStore((s) => s.removeTask);
  const reveal = useUiStore((s) => s.reveal);
  const { show } = useToast();

  // reveal_card 工具（小派对话里跳卡）命中本卡时：展开+滚进视野+临时高亮，对应原型 .card.flash
  useEffect(() => {
    if (reveal?.taskId !== taskId) return;
    setOpen(true);
    setFlash(true);
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = setTimeout(() => setFlash(false), FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [reveal?.taskId, reveal?.nonce, taskId]);

  if (!task) return null;

  const done = task.status === 'done';

  async function handleCopyAndOpen() {
    try {
      await navigator.clipboard?.writeText(task.prompt ?? '');
    } catch {
      // 某些环境剪贴板权限不可用，忽略——用户仍能在展开区看到完整提示词
    }
    if (task.fit !== 'self' && toolUrl) {
      browser.tabs.create({ url: toolUrl }).catch(() => {});
    }
    setCopied(true);
    show(task.fit === 'self' ? '小抄已复制' : `提示词已复制 — 粘贴到 ${toolName ?? '工具'} 就能用`);
    setTimeout(() => setCopied(false), COPIED_STATE_MS);
  }

  function handleComplete(e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    if (done) return;
    completeTask(task.id);
    if (cardRef.current) burstFrom(cardRef.current, e.currentTarget);
  }

  function handleConfirmDelete() {
    removeTask(task.id);
    show('已删除这件活儿');
  }

  return (
    <article
      ref={cardRef}
      className={cn(
        'relative mb-2 rounded-card border border-hairsoft bg-white shadow-card transition hover:border-hair hover:shadow-lift',
        flash && 'border-[rgba(61,111,252,.55)] shadow-[0_0_0_3.5px_rgba(61,111,252,.13)]',
      )}
    >

      <div
        role="button"
        tabIndex={0}
        aria-label={`展开任务：${task.title}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex cursor-pointer items-start gap-2.5 p-3"
      >
        <span
          role="checkbox"
          aria-checked={done}
          aria-label="标记完成"
          tabIndex={0}
          onClick={handleComplete}
          className={cn(
            'mt-0.5 flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border-[1.5px] transition',
            done ? 'border-transparent bg-ok' : 'border-black/20 bg-white hover:border-accent',
          )}
        >
          {done && <Icon name="check" className="h-2.5 w-2.5 text-white" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('text-[13.5px] font-semibold leading-snug', done && 'text-faint line-through')}>
            {task.title}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {task.due && (
              <Pill variant={task.due.hot ? 'due-hot' : 'due'} icon={<Icon name="clock" className="h-2.5 w-2.5" />}>
                {task.due.text}
              </Pill>
            )}
            <Pill variant={`fit-${task.fit}`}>{FIT_LABELS[task.fit]}</Pill>
            <span className="rounded-full border border-hairsoft px-2 py-0.5 text-[10.5px] text-faint">
              {TYPE_LABELS[task.type]}
            </span>
            {toolName && !done && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sub">
                <Icon name="spark" className="h-2.5 w-2.5 text-accent-ink" />
                {toolName}
              </span>
            )}
          </div>
        </div>
        <Icon name="chev" className={cn('mt-0.5 flex-none text-faint transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="space-y-2 px-3 pb-3 pl-[43px] text-[12.5px]">
          {task.note && <p className="text-sub">{task.note}</p>}
          {task.prompt && (
            <div className="rounded-lg border border-hairsoft bg-wash p-2.5 text-[12px] leading-relaxed text-[#3A3E44]">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-faint">
                {task.fit === 'self' ? '小抄' : '提示词'}
              </span>
              <span className="whitespace-pre-wrap">{renderPromptWithSlots(task.prompt)}</span>
            </div>
          )}
          {!done && (
            <div className="flex gap-2">
              <Button variant={copied ? 'success' : 'primary'} size="sm" className="flex-1" onClick={handleCopyAndOpen}>
                <Icon name={copied ? 'check' : 'copy'} />
                {copied
                  ? task.fit === 'self'
                    ? '已复制，改个称呼就能发'
                    : `已复制 · 真实插件会顺手打开 ${toolName ?? ''}`
                  : task.fit === 'self'
                    ? '复制小抄'
                    : `复制提示词${toolName ? ` · 打开 ${toolName}` : ''}`}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleComplete}>
                标记完成
              </Button>
            </div>
          )}

          {!deleteConfirming ? (
            <button
              type="button"
              aria-label="删除这件活儿"
              onClick={() => setDeleteConfirming(true)}
              className="text-[11.5px] text-faint underline"
            >
              删除这件活儿
            </button>
          ) : (
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="text-red">确定要删除？没有撤销，数据会直接没掉。</span>
              <Button variant="secondary" size="sm" className="!text-red" onClick={handleConfirmDelete}>
                确定删除
              </Button>
              <button type="button" onClick={() => setDeleteConfirming(false)} className="text-sub">
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
