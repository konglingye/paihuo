import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useMemoryStore } from '@/src/store/memoryStore';
import { memoryTools, recallTool, rememberTool } from './memory';

describe('memory 工具（remember/recall，spec §3.3）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useMemoryStore.setState({ facts: [] });
  });

  it('memoryTools 导出恰好是两个', () => {
    expect(memoryTools.map((t) => t.name).sort()).toEqual(['recall', 'remember']);
  });

  it('remember 是 write，recall 是 read（自动 run 不许调 remember）', () => {
    expect(rememberTool.effect).toBe('write');
    expect(recallTool.effect).toBe('read');
  });

  it('remember 落进 memoryStore', () => {
    rememberTool.handler({ fact: '他说过纪要要发飞书不发微信' });
    expect(useMemoryStore.getState().facts).toMatchObject([{ text: '他说过纪要要发飞书不发微信' }]);
  });

  it('recall 不传 topic 返回全部事实', () => {
    useMemoryStore.getState().remember('称呼：李哥');
    const result = recallTool.handler({});
    expect(result).toEqual({ facts: ['称呼：李哥'] });
  });

  it('recall 传 topic 只返回命中的事实', () => {
    useMemoryStore.getState().remember('称呼：李哥');
    useMemoryStore.getState().remember('纪要发飞书');
    expect(recallTool.handler({ topic: '飞书' })).toEqual({ facts: ['纪要发飞书'] });
  });
});
