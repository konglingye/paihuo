import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import {
  completeTaskTool,
  createTasksTool,
  getTaskTool,
  groupTasksTool,
  linkTasksTool,
  listTasksTool,
  taskTools,
  updateTaskTool,
} from './tasks';

const draftA = {
  title: '整理今天的会议纪要，下班前发群里',
  type: 'write' as const,
  fit: 'full' as const,
  saveMin: 40,
  fragmentId: 'f1',
};
const draftB = {
  title: '汇总上季度各区域销售数据',
  type: 'data' as const,
  fit: 'assist' as const,
  saveMin: 30,
  fragmentId: 'f1',
};

describe('任务库工具', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useGroupsStore.setState({ groups: {} });
    useRelationsStore.setState({ relations: [] });
  });

  it('导出的 taskTools 恰好是 7 个，且名字符合 arch §2 清单', () => {
    expect(taskTools.map((t) => t.name).sort()).toEqual(
      [
        'list_tasks',
        'get_task',
        'create_tasks',
        'update_task',
        'complete_task',
        'group_tasks',
        'link_tasks',
      ].sort(),
    );
  });

  describe('create_tasks', () => {
    it('schema 拒绝缺少必填字段的草稿', () => {
      const parsed = createTasksTool.paramsSchema.safeParse({ drafts: [{ title: '缺字段' }] });
      expect(parsed.success).toBe(false);
    });

    it('创建任务并写入 store', async () => {
      const result = await createTasksTool.handler({ drafts: [draftA, draftB] });
      expect(result).toHaveLength(2);
      expect(Object.values(useTasksStore.getState().tasks)).toHaveLength(2);
    });
  });

  describe('list_tasks', () => {
    it('不传 filter 返回全部任务', async () => {
      await createTasksTool.handler({ drafts: [draftA, draftB] });
      const result = await listTasksTool.handler({});
      expect(result).toHaveLength(2);
    });

    it('按 type 过滤', async () => {
      await createTasksTool.handler({ drafts: [draftA, draftB] });
      const result = await listTasksTool.handler({ type: 'data' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe(draftB.title);
    });
  });

  describe('get_task', () => {
    it('返回存在的任务', async () => {
      const [created] = await createTasksTool.handler({ drafts: [draftA] });
      const result = await getTaskTool.handler({ id: created.id });
      expect(result.id).toBe(created.id);
    });

    it('id 不存在时抛错（错误路径）', () => {
      expect(() => getTaskTool.handler({ id: 'not-exist' })).toThrow();
    });
  });

  describe('update_task', () => {
    it('局部更新已存在任务', async () => {
      const [created] = await createTasksTool.handler({ drafts: [draftA] });
      const updated = await updateTaskTool.handler({ id: created.id, patch: { note: '补充' } });
      expect(updated.note).toBe('补充');
      expect(updated.title).toBe(draftA.title);
    });

    it('id 不存在时抛错', () => {
      expect(() => updateTaskTool.handler({ id: 'not-exist', patch: { note: 'x' } })).toThrow();
    });
  });

  describe('complete_task', () => {
    it('标记完成并记录 doneAt', async () => {
      const [created] = await createTasksTool.handler({ drafts: [draftA] });
      const done = await completeTaskTool.handler({ id: created.id });
      expect(done.status).toBe('done');
      expect(done.doneAt).toBeTypeOf('number');
    });

    it('id 不存在时抛错', () => {
      expect(() => completeTaskTool.handler({ id: 'not-exist' })).toThrow();
    });
  });

  describe('group_tasks', () => {
    it('把任务归到新分组并回填 groupId', async () => {
      const [a, b] = await createTasksTool.handler({ drafts: [draftA, draftB] });
      const result = await groupTasksTool.handler({ ids: [a.id, b.id], label: '下周一 · 新品发布会' });
      expect(result.group.label).toBe('下周一 · 新品发布会');
      expect(result.group.kind).toBe('project');
      expect(useTasksStore.getState().tasks[a.id].groupId).toBe(result.group.id);
      expect(useTasksStore.getState().tasks[b.id].groupId).toBe(result.group.id);
    });

    it('包含不存在的任务 id 时抛错，不产生分组', async () => {
      const [a] = await createTasksTool.handler({ drafts: [draftA] });
      expect(() => groupTasksTool.handler({ ids: [a.id, 'not-exist'], label: 'x' })).toThrow();
      expect(Object.values(useGroupsStore.getState().groups)).toHaveLength(0);
    });
  });

  describe('link_tasks', () => {
    it('记录任务关联', async () => {
      const [a, b] = await createTasksTool.handler({ drafts: [draftA, draftB] });
      const relation = await linkTasksTool.handler({ ids: [a.id, b.id], reason: '用的是同一套信息' });
      expect(relation.taskIds).toEqual([a.id, b.id]);
      expect(useRelationsStore.getState().relations).toHaveLength(1);
    });

    it('包含不存在的任务 id 时抛错', async () => {
      const [a] = await createTasksTool.handler({ drafts: [draftA] });
      expect(() => linkTasksTool.handler({ ids: [a.id, 'not-exist'], reason: 'x' })).toThrow();
    });

    it('schema 要求至少 2 个任务 id', () => {
      const parsed = linkTasksTool.paramsSchema.safeParse({ ids: ['only-one'], reason: 'x' });
      expect(parsed.success).toBe(false);
    });
  });
});
