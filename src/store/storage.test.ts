import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { chromeStorage } from './storage';

describe('chromeStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('getItem 在没有值时返回 null', async () => {
    expect(await chromeStorage.getItem('missing-key')).toBeNull();
  });

  it('setItem 后 getItem 能读回同样的字符串', async () => {
    await chromeStorage.setItem('k', '{"a":1}');
    expect(await chromeStorage.getItem('k')).toBe('{"a":1}');
  });

  it('removeItem 后 getItem 返回 null', async () => {
    await chromeStorage.setItem('k', 'v');
    await chromeStorage.removeItem('k');
    expect(await chromeStorage.getItem('k')).toBeNull();
  });
});
