import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useMemoryStore } from './memoryStore';

describe('memoryStore（用户画像，spec §3.3）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useMemoryStore.setState({ facts: [] });
  });

  it('初始为空，profileText 返回空字符串', () => {
    expect(useMemoryStore.getState().facts).toEqual([]);
    expect(useMemoryStore.getState().profileText()).toBe('');
  });

  it('remember 追加一条事实，profileText 里能看到', () => {
    useMemoryStore.getState().remember('他姓李，部门是渠道运营');
    expect(useMemoryStore.getState().profileText()).toContain('他姓李，部门是渠道运营');
  });

  it('recall 不传 topic 返回全部事实', () => {
    useMemoryStore.getState().remember('称呼：李哥');
    useMemoryStore.getState().remember('纪要要发飞书不发微信');
    expect(useMemoryStore.getState().recall()).toEqual(['称呼：李哥', '纪要要发飞书不发微信']);
  });

  it('recall 传 topic 只返回包含关键词的事实', () => {
    useMemoryStore.getState().remember('称呼：李哥');
    useMemoryStore.getState().remember('纪要要发飞书不发微信');
    expect(useMemoryStore.getState().recall('飞书')).toEqual(['纪要要发飞书不发微信']);
  });

  it('超过 800 字上限时按最近使用淘汰最老的事实', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    useMemoryStore.getState().remember('A'.repeat(500));
    vi.setSystemTime(1000);
    useMemoryStore.getState().remember('B'.repeat(400)); // 900 字超限，淘汰最久没用的 A

    const texts = useMemoryStore.getState().facts.map((f) => f.text);
    expect(texts).not.toContain('A'.repeat(500));
    expect(texts).toContain('B'.repeat(400));
    vi.useRealTimers();
  });

  it('recall 会把命中的事实标记为最近使用，减缓被淘汰', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    useMemoryStore.getState().remember('事实一' + 'x'.repeat(197)); // 200 字，之后会被 recall 摸一下
    vi.setSystemTime(100);
    useMemoryStore.getState().remember('事实二' + 'y'.repeat(197)); // 200 字，之后不会被摸
    vi.setSystemTime(200);
    useMemoryStore.getState().recall('事实一'); // 摸一下事实一，让它比事实二更"新"
    vi.setSystemTime(300);
    useMemoryStore.getState().remember('z'.repeat(500)); // 200+200+500=900 超限，触发淘汰一条

    const texts = useMemoryStore.getState().facts.map((f) => f.text);
    expect(texts.some((t) => t.startsWith('事实一'))).toBe(true); // 被摸过，没被淘汰
    expect(texts.some((t) => t.startsWith('事实二'))).toBe(false); // 最久没用的，被淘汰
    vi.useRealTimers();
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:memory': JSON.stringify({
        state: { facts: [{ text: '历史事实', lastUsedAt: 100 }] },
        version: 1,
      }),
    });

    await useMemoryStore.persist.rehydrate();

    expect(useMemoryStore.getState().facts).toMatchObject([{ text: '历史事实' }]);
  });
});
