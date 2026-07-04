import { useMemo } from 'react';
import { Icon } from '@/src/components/icons/Icon';
import { Button, Chip, Pill, ProgressRing } from '@/src/components/ui';
import { useSettingsStore, useTasksStore, useUiStore } from '@/src/store';
import { TYPE_LABELS, TYPE_ORDER } from '@/src/components/tasks/taskTypeMeta';
import type { Task, TaskType } from '@/src/store/schema';

function greetingPrefix(hour: number): string {
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/** 省时格式化：60 分钟内直接说分钟，往上换算成小时（对应原型 fmtSave） */
function formatSaveMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const hours = Math.round(min / 6) / 10;
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)} 小时`;
}

const SECTION_LABEL_CLASS =
  'mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-faint';
const EMPTY_HINT_CLASS = 'rounded-xl border border-dashed border-hair bg-wash px-3 py-2.5 text-[12.5px] text-faint';

/** 总览 tab（spec §3.1）：问候+进度环+统计、按类型看、盯紧截止时间、今天的成果、写日报 CTA，全随 store 变化 */
export function OverviewPanel() {
  const tasksById = useTasksStore((s) => s.tasks);
  const tasks = useMemo(() => Object.values(tasksById), [tasksById]);
  const settings = useSettingsStore((s) => s.settings);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const setTaskFilter = useUiStore((s) => s.setTaskFilter);
  const revealTask = useUiStore((s) => s.revealTask);

  const total = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const done = doneTasks.length;
  const undoneSaveMin = tasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + t.saveMin, 0);
  const doneSaveMin = doneTasks.reduce((sum, t) => sum + t.saveMin, 0);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<TaskType, number>> = {};
    tasks.forEach((t) => {
      counts[t.type] = (counts[t.type] ?? 0) + 1;
    });
    return counts;
  }, [tasks]);

  const dueTasks = useMemo(
    () =>
      tasks
        .filter((t): t is Task & { due: NonNullable<Task['due']> } => !!t.due && t.status !== 'done')
        .sort((a, b) => Number(b.due.hot) - Number(a.due.hot)),
    [tasks],
  );

  const greeting = `${greetingPrefix(new Date().getHours())}${settings.userName ? `，${settings.userName}` : ''}`;

  function goToJobs(filter?: TaskType) {
    if (filter) setTaskFilter(filter);
    setActiveTab('jobs');
  }

  return (
    <div>
      <div className="flex items-center gap-3.5 border-b border-hairsoft px-4.5 py-4">
        <ProgressRing done={done} total={total} />
        <div>
          <div className="mb-0.5 text-[15.5px] font-semibold">{greeting}</div>
          <div className="text-xs tabular-nums text-sub">
            今天 {total} 件 · 完成 {done}
            {undoneSaveMin > 0 ? (
              <>
                {' '}
                · AI 预计帮你省 <b>≈{formatSaveMinutes(undoneSaveMin)}</b>
              </>
            ) : (
              ' · 今天可以准点走'
            )}
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="px-4.5 pt-4">
          <button
            type="button"
            onClick={() => goToJobs()}
            className="flex w-full items-center gap-2 rounded-xl border border-[rgba(61,111,252,.22)] bg-accent-soft px-3 py-2.5 text-left text-[12.5px] font-medium text-accent-ink"
          >
            <Icon name="inbox" className="h-3.5 w-3.5" />
            活儿还没倒进来——去「活儿」页倒一段试试
          </button>
        </div>
      )}

      <div className="px-4.5 pt-4">
        <div className={SECTION_LABEL_CLASS}>
          <Icon name="grid" className="h-3.5 w-3.5" />
          按类型看
        </div>
        {total === 0 ? (
          <p className={EMPTY_HINT_CLASS}>拆出活儿后，这里按类型分好类</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {TYPE_ORDER.filter((type) => typeCounts[type]).map((type) => (
              <Chip key={type} count={typeCounts[type]} onClick={() => goToJobs(type)}>
                {TYPE_LABELS[type]}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="px-4.5 pt-4">
        <div className={SECTION_LABEL_CLASS}>
          <Icon name="clock" className="h-3.5 w-3.5" />
          盯紧截止时间
        </div>
        {dueTasks.length === 0 ? (
          <p className={EMPTY_HINT_CLASS}>没有压着的截止时间，舒坦。</p>
        ) : (
          dueTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                setActiveTab('jobs');
                revealTask(task.id);
              }}
              className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-hairsoft bg-white px-3 py-2 text-left text-[12.5px] shadow-card transition hover:border-hair"
            >
              <Pill variant={task.due.hot ? 'due-hot' : 'due'} icon={<Icon name="clock" className="h-2.5 w-2.5" />}>
                {task.due.text}
              </Pill>
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <Icon name="chev" className="h-3 w-3 flex-none -rotate-90 text-faint" />
            </button>
          ))
        )}
      </div>

      <div className="px-4.5 pt-4">
        <div className={SECTION_LABEL_CLASS}>
          <Icon name="note" className="h-3.5 w-3.5" />
          今天的成果
        </div>
        <p className="rounded-xl border border-hair bg-wash px-3 py-2.5 text-[12.5px] leading-relaxed text-sub">
          {done > 0 ? (
            <>
              已划掉 <b className="text-ok">{done}</b> 件 · AI 帮你省了约 <b className="text-ok">{formatSaveMinutes(doneSaveMin)}</b>
              ——下班前点下面，一键写进日报。
            </>
          ) : (
            '还没划掉活儿。干完一件回来看看，这里会替你记着。'
          )}
        </p>
      </div>

      <div className="px-4.5 pb-4 pt-4">
        <Button variant="primary" size="md" className="w-full" onClick={() => setActiveTab('report')}>
          <Icon name="note" className="h-3.5 w-3.5" />
          把今天写成日报
        </Button>
      </div>
    </div>
  );
}
