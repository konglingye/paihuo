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
