import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from './tasksStore';
import type { TaskDraft } from './schema';

const draftA: TaskDraft = {
  title: '整理今天的会议纪要，下班前发群里',
  type: 'write',
  fit: 'full',
  toolId: 'doubao',
  saveMin: 40,
  fragmentId: 'f1',
  due: { text: '今天 18:00', hot: true },
};

const draftB: TaskDraft = {
  title: '汇总上季度各区域销售数据',
  type: 'data',
  fit: 'assist',
  saveMin: 30,
  fragmentId: 'f1',
};

describe('tasksStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
  });

  it('初始为空', () => {
    expect(useTasksStore.getState().tasks).toEqual({});
  });

  it('addTasks 生成 id/createdAt/status=todo 并写入', () => {
    const [created] = useTasksStore.getState().addTasks([draftA]);
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('todo');
    expect(created.createdAt).toBeTypeOf('number');
    expect(created.title).toBe(draftA.title);
    expect(Object.values(useTasksStore.getState().tasks)).toHaveLength(1);
  });

  it('addTasks 支持一次传多条', () => {
    useTasksStore.getState().addTasks([draftA, draftB]);
    expect(Object.values(useTasksStore.getState().tasks)).toHaveLength(2);
  });

  it('updateTask 局部更新已存在任务', () => {
    const [created] = useTasksStore.getState().addTasks([draftA]);
    useTasksStore.getState().updateTask(created.id, { note: '补充说明' });
    expect(useTasksStore.getState().tasks[created.id]?.note).toBe('补充说明');
    expect(useTasksStore.getState().tasks[created.id]?.title).toBe(draftA.title);
  });

  it('updateTask 对不存在的 id 是无操作', () => {
    const before = useTasksStore.getState().tasks;
    useTasksStore.getState().updateTask('not-exist', { note: 'x' });
    expect(useTasksStore.getState().tasks).toEqual(before);
  });

  it('completeTask 置为 done 并记录 doneAt', () => {
    const [created] = useTasksStore.getState().addTasks([draftA]);
    useTasksStore.getState().completeTask(created.id);
    const task = useTasksStore.getState().tasks[created.id];
    expect(task?.status).toBe('done');
    expect(task?.doneAt).toBeTypeOf('number');
  });

  it('removeTask 删除任务', () => {
    const [created] = useTasksStore.getState().addTasks([draftA]);
    useTasksStore.getState().removeTask(created.id);
    expect(useTasksStore.getState().tasks[created.id]).toBeUndefined();
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态（模拟重启扩展）', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:tasks': JSON.stringify({
        state: {
          tasks: {
            t1: {
              id: 't1',
              title: '已存在的任务',
              type: 'write',
              fit: 'full',
              status: 'todo',
              saveMin: 20,
              fragmentId: 'f1',
              createdAt: 1000,
            },
          },
        },
        version: 1,
      }),
    });

    await useTasksStore.persist.rehydrate();

    expect(useTasksStore.getState().tasks.t1).toMatchObject({ title: '已存在的任务', saveMin: 20 });
  });

  it('迁移：version 0 的 savedMinutes 字段重命名为 saveMin', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:tasks': JSON.stringify({
        state: {
          tasks: {
            legacy1: {
              id: 'legacy1',
              title: '旧版本任务',
              type: 'misc',
              fit: 'self',
              status: 'todo',
              savedMinutes: 15,
              fragmentId: 'f0',
              createdAt: 500,
            },
          },
        },
        version: 0,
      }),
    });

    await useTasksStore.persist.rehydrate();

    const migrated = useTasksStore.getState().tasks.legacy1;
    expect(migrated).toBeDefined();
    expect(migrated?.saveMin).toBe(15);
    expect((migrated as unknown as { savedMinutes?: number }).savedMinutes).toBeUndefined();
  });
});
