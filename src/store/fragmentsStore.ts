import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { Fragment, FragmentAttachment } from './schema';

interface FragmentsState {
  fragments: Record<string, Fragment>;
  addFragment: (input: { raw: string; attachments?: FragmentAttachment[] }) => Fragment;
}

export const useFragmentsStore = create<FragmentsState>()(
  persist(
    (set) => ({
      fragments: {},
      addFragment: (input) => {
        const fragment: Fragment = {
          id: crypto.randomUUID(),
          raw: input.raw,
          attachments: input.attachments ?? [],
          createdAt: Date.now(),
        };
        set((state) => ({ fragments: { ...state.fragments, [fragment.id]: fragment } }));
        return fragment;
      },
    }),
    {
      name: 'paihuo:fragments',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
