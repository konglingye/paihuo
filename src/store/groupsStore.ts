import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { Group, GroupKind } from './schema';

interface GroupsState {
  groups: Record<string, Group>;
  addGroup: (input: { label: string; kind: GroupKind }) => Group;
  removeGroup: (id: string) => void;
}

export const useGroupsStore = create<GroupsState>()(
  persist(
    (set) => ({
      groups: {},
      addGroup: (input) => {
        const group: Group = { id: crypto.randomUUID(), label: input.label, kind: input.kind };
        set((state) => ({ groups: { ...state.groups, [group.id]: group } }));
        return group;
      },
      removeGroup: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.groups;
          return { groups: rest };
        }),
    }),
    {
      name: 'paihuo:groups',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
