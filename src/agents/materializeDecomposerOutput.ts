import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import type { Group, Relation, Task, TaskDraft } from '@/src/store/schema';
import type { DecomposerOutput } from './profiles/decomposer';

export interface MaterializeResult {
  tasks: Task[];
  groups: Group[];
  relations: Relation[];
}

/**
 * 把拆解官输出（localId 互相引用）落成真实 store 记录：先建分组、再建任务（回填真实 groupId）、
 * 最后建关联（回填真实 taskId），localId 只在这一步内部使用，落库后即弃。
 */
export function materializeDecomposerOutput(output: DecomposerOutput, fragmentId: string): MaterializeResult {
  const groupIdByLocal = new Map<string, string>();
  const groups: Group[] = output.groups.map((g) => {
    const created = useGroupsStore.getState().addGroup({ label: g.label, kind: g.kind });
    groupIdByLocal.set(g.localId, created.id);
    return created;
  });

  const drafts: TaskDraft[] = output.tasks.map((t) => ({
    title: t.title,
    note: t.note,
    type: t.type,
    fit: t.fit,
    toolId: t.toolId,
    prompt: t.prompt,
    due: t.due,
    groupId: t.groupId ? groupIdByLocal.get(t.groupId) : undefined,
    saveMin: t.saveMin,
    fragmentId,
  }));
  const tasks = drafts.length ? useTasksStore.getState().addTasks(drafts) : [];
  const taskIdByLocal = new Map(output.tasks.map((t, i) => [t.localId, tasks[i].id]));

  const relations: Relation[] = output.relates
    .map((r) => {
      const realTaskIds = r.aIds.map((id) => taskIdByLocal.get(id)).filter((id): id is string => Boolean(id));
      if (realTaskIds.length < 2) return null;
      return useRelationsStore.getState().addRelation({
        taskIds: realTaskIds,
        reason: r.reason,
        suggestion: r.suggestion,
      });
    })
    .filter((r): r is Relation => r !== null);

  return { tasks, groups, relations };
}
