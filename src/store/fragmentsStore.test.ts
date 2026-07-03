import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useFragmentsStore } from './fragmentsStore';

describe('fragmentsStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useFragmentsStore.setState({ fragments: {} });
  });

  it('初始为空', () => {
    expect(useFragmentsStore.getState().fragments).toEqual({});
  });

  it('addFragment 生成 id/createdAt 并写入', () => {
    const created = useFragmentsStore.getState().addFragment({ raw: '领导甩活儿原话', attachments: [{ name: 'a.pdf' }] });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTypeOf('number');
    expect(useFragmentsStore.getState().fragments[created.id]).toEqual(created);
  });

  it('addFragment 不传附件时默认空数组', () => {
    const created = useFragmentsStore.getState().addFragment({ raw: '随手一句' });
    expect(created.attachments).toEqual([]);
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:fragments': JSON.stringify({
        state: { fragments: { f1: { id: 'f1', raw: '旧片段', attachments: [], createdAt: 100 } } },
        version: 1,
      }),
    });

    await useFragmentsStore.persist.rehydrate();

    expect(useFragmentsStore.getState().fragments.f1).toMatchObject({ raw: '旧片段' });
  });
});
