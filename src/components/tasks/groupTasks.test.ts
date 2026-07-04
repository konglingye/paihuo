import { describe, expect, it } from 'vitest';
import { buildDisplayGroups } from './groupTasks';
import type { Group, Relation, Task } from '@/src/store/schema';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 'x',
    title: 'x',
    type: 'misc',
    fit: 'self',
    status: 'todo',
    saveMin: 0,
    fragmentId: 'f1',
    createdAt: 0,
    ...overrides,
  };
}

describe('buildDisplayGroups', () => {
  it('due.hot 的任务归到紧急组（今天必须交），排在最前', () => {
    const urgentTask = makeTask({ id: 't1', due: { text: '今天 18:00', hot: true } });
    const dailyTask = makeTask({ id: 't2' });
    const groups = buildDisplayGroups([dailyTask, urgentTask], {}, []);

    expect(groups[0]).toMatchObject({ kind: 'urgent', label: '今天必须交' });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1']);
  });

  it('有 groupId 的任务归到对应项目组，标签用 Group.label', () => {
    const group: Group = { id: 'g1', label: '下周一 · 新品发布会', kind: 'project' };
    const t1 = makeTask({ id: 't1', groupId: 'g1' });
    const t2 = makeTask({ id: 't2', groupId: 'g1' });
    const groups = buildDisplayGroups([t1, t2], { g1: group }, []);

    const projectGroup = groups.find((g) => g.kind === 'project');
    expect(projectGroup?.label).toBe('下周一 · 新品发布会');
    expect(projectGroup?.tasks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('项目组会算出组内有关联的任务数', () => {
    const group: Group = { id: 'g1', label: '发布会', kind: 'project' };
    const t1 = makeTask({ id: 't1', groupId: 'g1' });
    const t2 = makeTask({ id: 't2', groupId: 'g1' });
    const t3 = makeTask({ id: 't3', groupId: 'g1' });
    const relation: Relation = { id: 'r1', taskIds: ['t1', 't2'], reason: 'x', createdAt: 0 };
    const groups = buildDisplayGroups([t1, t2, t3], { g1: group }, [relation]);

    const projectGroup = groups.find((g) => g.kind === 'project');
    expect(projectGroup?.relatedCount).toBe(2);
  });

  it('既没有 due.hot 也没有 groupId 的任务归到日常组，排在最后', () => {
    const t1 = makeTask({ id: 't1' });
    const groups = buildDisplayGroups([t1], {}, []);
    expect(groups[groups.length - 1]).toMatchObject({ kind: 'daily', label: '日常' });
  });

  it('空分组不出现在结果里', () => {
    const t1 = makeTask({ id: 't1' });
    const groups = buildDisplayGroups([t1], {}, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('daily');
  });

  it('顺序固定为 紧急 → 项目组（按出现顺序）→ 日常', () => {
    const group: Group = { id: 'g1', label: '项目', kind: 'project' };
    const urgent = makeTask({ id: 'u1', due: { text: '今天', hot: true } });
    const project = makeTask({ id: 'p1', groupId: 'g1' });
    const daily = makeTask({ id: 'd1' });
    const groups = buildDisplayGroups([daily, project, urgent], { g1: group }, []);
    expect(groups.map((g) => g.kind)).toEqual(['urgent', 'project', 'daily']);
  });
});
