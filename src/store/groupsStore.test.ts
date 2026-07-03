import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useGroupsStore } from './groupsStore';

describe('groupsStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useGroupsStore.setState({ groups: {} });
  });

  it('初始为空', () => {
    expect(useGroupsStore.getState().groups).toEqual({});
  });

  it('addGroup 生成 id 并写入', () => {
    const created = useGroupsStore.getState().addGroup({ label: '下周一 · 新品发布会', kind: 'project' });
    expect(created.id).toBeTruthy();
    expect(useGroupsStore.getState().groups[created.id]).toEqual(created);
  });

  it('removeGroup 删除分组', () => {
    const created = useGroupsStore.getState().addGroup({ label: '今天必须交', kind: 'urgent' });
    useGroupsStore.getState().removeGroup(created.id);
    expect(useGroupsStore.getState().groups[created.id]).toBeUndefined();
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:groups': JSON.stringify({
        state: { groups: { g1: { id: 'g1', label: '日常', kind: 'daily' } } },
        version: 1,
      }),
    });

    await useGroupsStore.persist.rehydrate();

    expect(useGroupsStore.getState().groups.g1).toMatchObject({ label: '日常', kind: 'daily' });
  });
});
