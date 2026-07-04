import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { Relation } from './schema';

interface RelationsState {
  relations: Relation[];
  addRelation: (input: { taskIds: string[]; reason: string; suggestion?: string }) => Relation;
  removeRelation: (id: string) => void;
}

/** taskIds 顺序不重要，比的是同一组任务——用排序后拼接的 key 判断"是不是同一条关联" */
function taskIdsKey(taskIds: string[]): string {
  return [...taskIds].sort().join('|');
}

export const useRelationsStore = create<RelationsState>()(
  persist(
    (set, get) => ({
      relations: [],
      addRelation: (input) => {
        // 整理官会在每次倒活时自动重跑（dump.created->auto-organize），只要相关任务还在，
        // 同一对任务大概率会被反复建议——不去重会让关联横幅无限叠加一模一样的内容
        const key = taskIdsKey(input.taskIds);
        const existing = get().relations.find((r) => taskIdsKey(r.taskIds) === key);
        if (existing) return existing;

        const relation: Relation = {
          id: crypto.randomUUID(),
          taskIds: input.taskIds,
          reason: input.reason,
          suggestion: input.suggestion,
          createdAt: Date.now(),
        };
        set((state) => ({ relations: [...state.relations, relation] }));
        return relation;
      },
      removeRelation: (id) =>
        set((state) => ({ relations: state.relations.filter((r) => r.id !== id) })),
    }),
    {
      name: 'paihuo:relations',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
