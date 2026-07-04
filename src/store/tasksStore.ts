import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import { eventBus } from '@/src/agents/events';
import type { Task, TaskDraft } from './schema';

interface TasksState {
  tasks: Record<string, Task>;
  addTasks: (drafts: TaskDraft[]) => Task[];
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string) => void;
  removeTask: (id: string) => void;
}

/** v0 → v1：任务的省时字段从 savedMinutes 改名为 saveMin */
function migrateTaskFromV0(legacy: Record<string, unknown>): Task {
  const { savedMinutes, ...rest } = legacy as Task & { savedMinutes?: number };
  return {
    ...rest,
    saveMin: rest.saveMin ?? savedMinutes ?? 0,
  } as Task;
}

function migrateTasksState(persisted: unknown, version: number): { tasks: Record<string, Task> } {
  const state = (persisted as { tasks?: Record<string, unknown> } | undefined) ?? {};
  let tasks = state.tasks ?? {};
  if (version < 1) {
    tasks = Object.fromEntries(
      Object.entries(tasks).map(([id, t]) => [id, migrateTaskFromV0(t as Record<string, unknown>)]),
    );
  }
  return { tasks: tasks as Record<string, Task> };
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: {},
      addTasks: (drafts) => {
        const created: Task[] = drafts.map((draft) => ({
          ...draft,
          id: crypto.randomUUID(),
          status: 'todo',
          createdAt: Date.now(),
        }));
        set((state) => ({
          tasks: created.reduce(
            (acc, task) => ({ ...acc, [task.id]: task }),
            { ...state.tasks },
          ),
        }));
        return created;
      },
      updateTask: (id, patch) =>
        set((state) => {
          const existing = state.tasks[id];
          if (!existing) return state;
          return { tasks: { ...state.tasks, [id]: { ...existing, ...patch } } };
        }),
      completeTask: (id) => {
        const existed = !!get().tasks[id];
        set((state) => {
          const existing = state.tasks[id];
          if (!existing) return state;
          return {
            tasks: { ...state.tasks, [id]: { ...existing, status: 'done', doneAt: Date.now() } },
          };
        });
        // task.completed 事件（arch §5）：整理官轻量检查有没有已知关联的下一件任务可以建议
        if (existed) void eventBus.emit({ type: 'task.completed', taskId: id });
      },
      removeTask: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.tasks;
          return { tasks: rest };
        }),
    }),
    {
      name: 'paihuo:tasks',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
      migrate: (persisted, version) => migrateTasksState(persisted, version) as TasksState,
    },
  ),
);
