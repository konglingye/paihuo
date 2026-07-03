import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { ReportKind, ReportRecord } from './schema';

interface ReportsState {
  reports: ReportRecord[];
  addReport: (input: { kind: ReportKind; content: string }) => ReportRecord;
}

export const useReportsStore = create<ReportsState>()(
  persist(
    (set) => ({
      reports: [],
      addReport: (input) => {
        const report: ReportRecord = {
          id: crypto.randomUUID(),
          kind: input.kind,
          content: input.content,
          createdAt: Date.now(),
        };
        set((state) => ({ reports: [...state.reports, report] }));
        return report;
      },
    }),
    {
      name: 'paihuo:reports',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
