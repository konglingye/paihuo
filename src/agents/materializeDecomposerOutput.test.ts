import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { materializeDecomposerOutput } from './materializeDecomposerOutput';
import type { DecomposerOutput } from './profiles/decomposer';

describe('materializeDecomposerOutput', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useGroupsStore.setState({ groups: {} });
    useRelationsStore.setState({ relations: [] });
  });

  it('把发布会四任务剧本落成真实 task/group/relation 记录，localId 正确映射成真实 id', () => {
    const output: DecomposerOutput = {
      tasks: [
        { localId: 'n1', title: '整理会议纪要', type: 'write', fit: 'full', saveMin: 40 },
        { localId: 'n2', title: '发布会 PPT', type: 'slide', fit: 'assist', groupId: 'g1', saveMin: 90 },
        { localId: 'n3', title: '发布会宣传文案', type: 'write', fit: 'full', groupId: 'g1', saveMin: 50 },
        { localId: 'n4', title: '汇总销售数据', type: 'data', fit: 'assist', saveMin: 30 },
      ],
      groups: [{ localId: 'g1', label: '下周一 · 新品发布会', kind: 'project' }],
      relates: [{ aIds: ['n2', 'n3'], reason: '用的是同一套信息', suggestion: '先定关键信息' }],
    };

    const result = materializeDecomposerOutput(output, 'fragment-1');

    expect(result.tasks).toHaveLength(4);
    expect(result.groups).toHaveLength(1);
    expect(result.relations).toHaveLength(1);

    const ppt = result.tasks.find((t) => t.title === '发布会 PPT')!;
    const copy = result.tasks.find((t) => t.title === '发布会宣传文案')!;
    const group = result.groups[0];

    // groupId 从 localId 正确映射成真实 group id
    expect(ppt.groupId).toBe(group.id);
    expect(copy.groupId).toBe(group.id);

    // relation 的 taskIds 从 localId 正确映射成真实 task id
    expect(result.relations[0].taskIds.sort()).toEqual([ppt.id, copy.id].sort());
    expect(result.relations[0].suggestion).toBe('先定关键信息');

    // 每个任务都带上调用方传入的 fragmentId
    result.tasks.forEach((t) => expect(t.fragmentId).toBe('fragment-1'));

    // store 里确实落了库
    expect(Object.keys(useTasksStore.getState().tasks)).toHaveLength(4);
    expect(Object.keys(useGroupsStore.getState().groups)).toHaveLength(1);
    expect(useRelationsStore.getState().relations).toHaveLength(1);
  });

  it('没有 groups/relates 时也能正常工作', () => {
    const output: DecomposerOutput = {
      tasks: [{ localId: 'n1', title: '随手一件事', type: 'misc', fit: 'self', saveMin: 5 }],
      groups: [],
      relates: [],
    };
    const result = materializeDecomposerOutput(output, 'fragment-2');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].groupId).toBeUndefined();
    expect(result.groups).toEqual([]);
    expect(result.relations).toEqual([]);
  });

  it('relates 引用了不存在的 localId 时跳过该条关联，不抛错', () => {
    const output: DecomposerOutput = {
      tasks: [{ localId: 'n1', title: 'x', type: 'misc', fit: 'self', saveMin: 5 }],
      groups: [],
      relates: [{ aIds: ['n1', 'not-exist'], reason: 'x', suggestion: 'y' }],
    };
    const result = materializeDecomposerOutput(output, 'fragment-3');
    expect(result.relations).toEqual([]);
  });
});
