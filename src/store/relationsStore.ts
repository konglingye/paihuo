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

export const useRelationsStore = create<RelationsState>()(
  persist(
    (set) => ({
      relations: [],
      addRelation: (input) => {
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
