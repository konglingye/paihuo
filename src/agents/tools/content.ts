import { z } from 'zod';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import type { ToolDefinition } from '../harness/tools';

const CHUNK_SIZE = 2000;

function fullTextOf(fragmentId: string): string {
  const fragment = useFragmentsStore.getState().fragments[fragmentId];
  if (!fragment) throw new Error(`片段不存在：${fragmentId}`);
  const attachmentTexts = fragment.attachments.map((a) => a.text).filter((t): t is string => Boolean(t));
  return [fragment.raw, ...attachmentTexts].join('\n\n');
}

const ReadAttachmentParams = z.object({
  fragmentId: z.string(),
  chunk: z.number().int().min(0).optional(),
});

export interface ReadAttachmentResult {
  chunk: number;
  totalChunks: number;
  hasMore: boolean;
  text: string;
}

/**
 * 分块读取长文档原文，chunk 从 0 开始，不传则返回第 0 块。
 * 长文档由模型自己翻页，避免一次性把全文灌进上下文（arch §3.1「检索优先于灌注」）。
 */
export const readAttachmentTool: ToolDefinition<z.infer<typeof ReadAttachmentParams>, ReadAttachmentResult> = {
  name: 'read_attachment',
  description: '分块读取长文档原文（附件或原始输入），chunk 从 0 开始，不传则返回第 0 块',
  paramsSchema: ReadAttachmentParams,
  effect: 'read',
  handler: ({ fragmentId, chunk = 0 }) => {
    const text = fullTextOf(fragmentId);
    const totalChunks = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));
    if (chunk >= totalChunks) {
      throw new Error(`chunk 超出范围：共 ${totalChunks} 块，请求了第 ${chunk} 块`);
    }
    const start = chunk * CHUNK_SIZE;
    return {
      chunk,
      totalChunks,
      hasMore: chunk < totalChunks - 1,
      text: text.slice(start, start + CHUNK_SIZE),
    };
  },
};
