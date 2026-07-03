import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useReportsStore } from './reportsStore';

describe('reportsStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useReportsStore.setState({ reports: [] });
  });

  it('初始为空数组', () => {
    expect(useReportsStore.getState().reports).toEqual([]);
  });

  it('addReport 生成 id/createdAt 并追加到末尾', () => {
    const r1 = useReportsStore.getState().addReport({ kind: 'daily', content: '今日完成 3 件' });
    const r2 = useReportsStore.getState().addReport({ kind: 'weekly', content: '本周复盘' });
    expect(useReportsStore.getState().reports.map((r) => r.id)).toEqual([r1.id, r2.id]);
    expect(r1.createdAt).toBeTypeOf('number');
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:reports': JSON.stringify({
        state: { reports: [{ id: 'r1', kind: 'daily', content: '历史日报', createdAt: 100 }] },
        version: 1,
      }),
    });

    await useReportsStore.persist.rehydrate();

    expect(useReportsStore.getState().reports).toMatchObject([{ id: 'r1', content: '历史日报' }]);
  });
});
