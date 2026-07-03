import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import { readAttachmentTool } from './content';

describe('read_attachment', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useFragmentsStore.setState({ fragments: {} });
  });

  it('片段不存在时抛错', () => {
    expect(() => readAttachmentTool.handler({ fragmentId: 'not-exist' })).toThrow();
  });

  it('短文本一块就能读完，hasMore=false', async () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: '一段不长的原话' });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result).toEqual({ chunk: 0, totalChunks: 1, hasMore: false, text: '一段不长的原话' });
  });

  it('不传 chunk 时默认返回第 0 块', async () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: 'x'.repeat(5000) });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result.chunk).toBe(0);
  });

  it('长文档按块翻页，chunk 拼起来等于原文，最后一块 hasMore=false', async () => {
    const raw = Array.from({ length: 5000 }, (_, i) => String(i % 10)).join('');
    const fragment = useFragmentsStore.getState().addFragment({ raw });

    const first = await readAttachmentTool.handler({ fragmentId: fragment.id, chunk: 0 });
    expect(first.hasMore).toBe(true);
    expect(first.totalChunks).toBeGreaterThan(1);

    let combined = '';
    for (let i = 0; i < first.totalChunks; i++) {
      const part = await readAttachmentTool.handler({ fragmentId: fragment.id, chunk: i });
      combined += part.text;
      expect(part.hasMore).toBe(i < first.totalChunks - 1);
    }
    expect(combined).toBe(raw);
  });

  it('chunk 超出范围时抛错（错误路径）', async () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: '短文本' });
    expect(() => readAttachmentTool.handler({ fragmentId: fragment.id, chunk: 99 })).toThrow();
  });

  it('附件文本也会拼进可读取的全文', async () => {
    const fragment = useFragmentsStore.getState().addFragment({
      raw: '正文部分',
      attachments: [{ name: 'a.txt', text: '附件里的内容' }],
    });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result.text).toContain('正文部分');
    expect(result.text).toContain('附件里的内容');
  });

  it('schema 拒绝负数 chunk', () => {
    const parsed = readAttachmentTool.paramsSchema.safeParse({ fragmentId: 'f1', chunk: -1 });
    expect(parsed.success).toBe(false);
  });
});
