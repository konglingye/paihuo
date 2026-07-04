import { useMemo } from 'react';
import { Chip } from '@/src/components/ui';
import type { TaskFilter } from '@/src/store/uiStore';
import type { Task, TaskType } from '@/src/store/schema';

const TYPE_LABELS: Record<TaskType, string> = {
  write: '写作',
  slide: '演示',
  data: '数据',
  comm: '沟通',
  misc: '杂事',
};

const TYPE_ORDER: TaskType[] = ['write', 'slide', 'data', 'comm', 'misc'];

export interface TypeFilterRowProps {
  tasks: Task[];
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

/** 类型筛选行：全部/写作/演示/数据/沟通/杂事 + 计数，单选（spec §3.2） */
export function TypeFilterRow({ tasks, value, onChange }: TypeFilterRowProps) {
  const counts = useMemo(() => {
    const c: Partial<Record<TaskType, number>> = {};
    tasks.forEach((t) => {
      c[t.type] = (c[t.type] ?? 0) + 1;
    });
    return c;
  }, [tasks]);

  return (
    <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
      <Chip active={value === 'all'} count={tasks.length} onClick={() => onChange('all')}>
        全部
      </Chip>
      {TYPE_ORDER.filter((type) => counts[type]).map((type) => (
        <Chip key={type} active={value === type} count={counts[type]} onClick={() => onChange(type)}>
          {TYPE_LABELS[type]}
        </Chip>
      ))}
    </div>
  );
}
