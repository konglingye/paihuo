import { useState } from 'react';
import { Icon } from '@/src/components/icons/Icon';
import { Pill, Button } from '@/src/components/ui';
import { useTasksStore } from '@/src/store';
import { cn } from '@/src/lib/cn';
import type { Task } from '@/src/store/schema';

const TYPE_LABELS: Record<Task['type'], string> = {
  write: '写作',
  slide: '演示',
  data: '数据',
  comm: '沟通',
  misc: '杂事',
};

const FIT_LABELS: Record<Task['fit'], string> = {
  full: 'AI 可代劳',
  assist: 'AI 打下手',
  self: '自己来 · 有小抄',
};

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

export interface TaskCardProps {
  taskId: string;
  toolName?: string;
}

/** 任务卡：对应原型 .card，逐张入场动效由列表容器负责，这里只管自身的展开/收起与操作 */
export function TaskCard({ taskId, toolName }: TaskCardProps) {
  const [open, setOpen] = useState(false);
  const task = useTasksStore((s) => s.tasks[taskId]);
  const completeTask = useTasksStore((s) => s.completeTask);

  if (!task) return null;

  const done = task.status === 'done';

  return (
    <article className="mb-2 rounded-card border border-hairsoft bg-white shadow-card transition hover:border-hair hover:shadow-lift">
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
          onClick={(e) => {
            e.stopPropagation();
            if (!done) completeTask(task.id);
          }}
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
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => navigator.clipboard?.writeText(task.prompt ?? '')}
              >
                <Icon name="copy" />
                {task.fit === 'self' ? '复制小抄' : `复制提示词${toolName ? ` · 打开 ${toolName}` : ''}`}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => completeTask(task.id)}>
                标记完成
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
