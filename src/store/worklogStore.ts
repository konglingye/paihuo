import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import type { Task } from './schema';

export interface WorklogEntry {
  date: string; // YYYY-MM-DD
  summary: string;
}

/** 工作日志滚动保留天数（arch §3.3） */
const RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.abs(Date.parse(dateA) - Date.parse(dateB)) / MS_PER_DAY;
}

/** 纯函数：给定任务列表和某一天，算出"完成了什么、省时多少"的一句话摘要（供 reporter 写周报月报） */
export function buildDailySummary(tasks: Task[], date: string): string {
  const doneThatDay = tasks.filter((t) => t.doneAt !== undefined && toDateKey(t.doneAt) === date);
  if (doneThatDay.length === 0) return '今天没有标记完成的活儿';
  const savedMin = doneThatDay.reduce((sum, t) => sum + t.saveMin, 0);
  const titles = doneThatDay.map((t) => t.title).join('、');
  return `完成 ${doneThatDay.length} 件活儿，预计省时 ${savedMin} 分钟：${titles}`;
}

interface WorklogState {
  entries: WorklogEntry[];
  /** 上一次记录到的"活跃日期"，用来判断今天是不是新的一天 */
  lastActiveDate: string | null;
  /** 写入或覆盖指定日期的摘要，并裁掉超过 90 天的旧条目 */
  recordDay: (date: string, tasks: Task[]) => void;
  /**
   * 会话次日归档（arch §3.3）：如果当前日期和上次活跃日期不是同一天，
   * 把上一个活跃日期的任务完成情况归档成一条工作日志，再把 lastActiveDate 更新成今天。
   */
  archiveIfNewDay: (currentDate: string, tasks: Task[]) => void;
}

export const useWorklogStore = create<WorklogState>()(
  persist(
    (set, get) => ({
      entries: [],
      lastActiveDate: null,
      recordDay: (date, tasks) => {
        const summary = buildDailySummary(tasks, date);
        set((state) => {
          const withoutThatDay = state.entries.filter((e) => e.date !== date);
          const next = [...withoutThatDay, { date, summary }];
          return { entries: next.filter((e) => daysBetween(e.date, date) <= RETENTION_DAYS) };
        });
      },
      archiveIfNewDay: (currentDate, tasks) => {
        const { lastActiveDate } = get();
        if (lastActiveDate && lastActiveDate !== currentDate) {
          get().recordDay(lastActiveDate, tasks);
        }
        set((state) => ({
          lastActiveDate: currentDate,
          entries: state.entries.filter((e) => daysBetween(e.date, currentDate) <= RETENTION_DAYS),
        }));
      },
    }),
    {
      name: 'paihuo:worklog',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
