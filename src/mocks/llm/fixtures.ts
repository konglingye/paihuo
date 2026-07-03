import type { Usage } from '@/src/llm/types';

export interface LlmFixture {
  id: string;
  /** 命中最后一条用户消息即选用该 fixture；未命中任何 fixture 时退回 DEFAULT_FIXTURE */
  match?: (lastUserMessage: string) => boolean;
  /** 分片模拟——每个字符串是一次 onDelta 增量 */
  chunks: string[];
  usage?: Usage;
  /** 每个分片之间的模拟延迟（毫秒），默认 10 */
  delayMs?: number;
}

export const DEFAULT_FIXTURE: LlmFixture = {
  id: 'default-greeting',
  chunks: ['收到，', '我先看看能帮你做点什么。'],
  usage: { promptTokens: 20, completionTokens: 12, totalTokens: 32 },
};

export const FIXTURES: LlmFixture[] = [
  {
    id: 'meeting-notes-done',
    match: (msg) => msg.includes('纪要') && msg.includes('发完'),
    chunks: ['真棒，', '这件事我先帮你划掉。', '接下来手里还有 3 件，要不要先看看今天能顺手做完的？'],
    usage: { promptTokens: 40, completionTokens: 24, totalTokens: 64 },
  },
];

export function findFixture(lastUserMessage: string): LlmFixture {
  return FIXTURES.find((f) => f.match?.(lastUserMessage)) ?? DEFAULT_FIXTURE;
}
