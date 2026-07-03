import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { AgentRun } from '@/src/agents/harness/trace';

const MAX_RUNS = 100;

interface TraceState {
  runs: AgentRun[];
  addRun: (run: AgentRun) => void;
  clearRuns: () => void;
}

/** AgentRun 环形缓冲区，最近 100 条（arch §6）；#/trace dev 页读这里 */
export const useTraceStore = create<TraceState>()(
  persist(
    (set) => ({
      runs: [],
      addRun: (run) => set((state) => ({ runs: [run, ...state.runs].slice(0, MAX_RUNS) })),
      clearRuns: () => set({ runs: [] }),
    }),
    {
      name: 'paihuo:trace',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
