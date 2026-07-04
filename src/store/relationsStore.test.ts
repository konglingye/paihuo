import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useRelationsStore } from './relationsStore';

describe('relationsStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useRelationsStore.setState({ relations: [] });
  });

  it('初始为空数组', () => {
    expect(useRelationsStore.getState().relations).toEqual([]);
  });

  it('addRelation 生成 id/createdAt 并追加', () => {
    const r = useRelationsStore.getState().addRelation({ taskIds: ['t1', 't2'], reason: '用的是同一套信息' });
    expect(r.id).toBeTruthy();
    expect(r.createdAt).toBeTypeOf('number');
    expect(useRelationsStore.getState().relations).toEqual([r]);
  });

  it('removeRelation 移除指定关联（用户点了"分开做"）', () => {
    const r = useRelationsStore.getState().addRelation({ taskIds: ['t1', 't2'], reason: 'x' });
    useRelationsStore.getState().removeRelation(r.id);
    expect(useRelationsStore.getState().relations).toEqual([]);
  });

  it('addRelation 对完全相同的 taskIds 集合去重：返回已有的那条，不新建重复记录（真实使用中发现的 bug——每次倒活都会触发自动整理官，同一对任务反复被建议，之前会无限叠加出一模一样的关联横幅）', () => {
    const first = useRelationsStore.getState().addRelation({ taskIds: ['t1', 't2'], reason: '第一次的说法' });
    const second = useRelationsStore.getState().addRelation({ taskIds: ['t2', 't1'], reason: '第二次的说法，顺序还反了' });
    expect(second.id).toBe(first.id);
    expect(useRelationsStore.getState().relations).toHaveLength(1);
  });

  it('taskIds 集合不同则正常新建，不会被误判成重复', () => {
    useRelationsStore.getState().addRelation({ taskIds: ['t1', 't2'], reason: 'x' });
    useRelationsStore.getState().addRelation({ taskIds: ['t1', 't3'], reason: 'y' });
    expect(useRelationsStore.getState().relations).toHaveLength(2);
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:relations': JSON.stringify({
        state: { relations: [{ id: 'r1', taskIds: ['a', 'b'], reason: '历史关联', createdAt: 100 }] },
        version: 1,
      }),
    });

    await useRelationsStore.persist.rehydrate();

    expect(useRelationsStore.getState().relations).toMatchObject([{ id: 'r1', reason: '历史关联' }]);
  });
});
