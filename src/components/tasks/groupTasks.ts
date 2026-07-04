import type { Group, GroupKind, Relation, Task } from '@/src/store/schema';

export interface DisplayGroup {
  key: string;
  kind: GroupKind;
  label: string;
  /** 项目组才有：组内互相关联的任务数（原型「2 件有关联」） */
  relatedCount?: number;
  tasks: Task[];
}

/**
 * 把任务分桶成三种展示分组：紧急（due.hot）/ 项目（有 groupId）/ 日常（其余），
 * 顺序固定紧急→项目→日常，对应原型 .group-h 的三态（spec §3.2）。
 */
export function buildDisplayGroups(
  tasks: Task[],
  groupsById: Record<string, Group>,
  relations: Relation[],
): DisplayGroup[] {
  const urgent: Task[] = [];
  const daily: Task[] = [];
  const byGroupId = new Map<string, Task[]>();

  for (const task of tasks) {
    if (task.groupId && groupsById[task.groupId]) {
      const bucket = byGroupId.get(task.groupId) ?? [];
      bucket.push(task);
      byGroupId.set(task.groupId, bucket);
    } else if (task.due?.hot) {
      urgent.push(task);
    } else {
      daily.push(task);
    }
  }

  const result: DisplayGroup[] = [];

  if (urgent.length > 0) {
    result.push({ key: 'urgent', kind: 'urgent', label: '今天必须交', tasks: urgent });
  }

  for (const [groupId, groupTasks] of byGroupId) {
    const group = groupsById[groupId];
    const taskIdSet = new Set(groupTasks.map((t) => t.id));
    const relatedIds = new Set(
      relations.flatMap((r) => r.taskIds).filter((id) => taskIdSet.has(id)),
    );
    result.push({
      key: groupId,
      kind: 'project',
      label: group.label,
      relatedCount: relatedIds.size || undefined,
      tasks: groupTasks,
    });
  }

  if (daily.length > 0) {
    result.push({ key: 'daily', kind: 'daily', label: '日常', tasks: daily });
  }

  return result;
}
