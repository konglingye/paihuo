import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useCaptureStore } from './captureStore';

describe('captureStore（右键收集中转，spec §7）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useCaptureStore.setState({ pendingText: null });
  });

  it('初始为空', () => {
    expect(useCaptureStore.getState().pendingText).toBeNull();
  });

  it('setPendingText 记录选中文本', () => {
    useCaptureStore.getState().setPendingText('选中的一段话');
    expect(useCaptureStore.getState().pendingText).toBe('选中的一段话');
  });

  it('takePendingText 取走文本并清空，避免重复消费', () => {
    useCaptureStore.getState().setPendingText('选中的一段话');
    expect(useCaptureStore.getState().takePendingText()).toBe('选中的一段话');
    expect(useCaptureStore.getState().pendingText).toBeNull();
    expect(useCaptureStore.getState().takePendingText()).toBeNull();
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:capture': JSON.stringify({ state: { pendingText: '来自另一个上下文的文本' }, version: 1 }),
    });

    await useCaptureStore.persist.rehydrate();

    expect(useCaptureStore.getState().pendingText).toBe('来自另一个上下文的文本');
  });
});
