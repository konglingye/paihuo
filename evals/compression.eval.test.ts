/**
 * 压缩 evals（arch §7）：长会话压缩后，关键未决事项仍能被后续问答召回。
 * 不只测 compressHistory 本身的机制（那是 T07 context.test.ts 的事），而是端到端跑一遍：
 * 压缩 → 把压缩结果当成 history 喂给下一轮 runChat → 追问 → 断言回答里带着那件未决事项。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { compressHistory, needsCompression } from '@/src/agents/harness/context';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { runChat } from '@/src/agents/runChat';
import type { ChatMessage } from '@/src/llm/types';
import type { LlmDriver } from '@/src/agents/harness/llmDriver';

const PENDING_ITEM = '还欠张总那份合同的审批跟进，周五之前要处理';
const FILLER = '闲聊：今天天气不错，中午吃什么还没想好。'.repeat(60);

/** 模拟一个"够用"的摘要模型：从老消息里抠出提到未决事项关键词的那句话，不是瞎编的固定字符串 */
async function summarize(oldMessages: ChatMessage[]): Promise<string> {
  const hit = oldMessages.find((m) => m.content.includes('张总') && m.content.includes('合同'));
  return hit ? `未决事项：${hit.content.slice(0, 60)}` : '（没有发现明确的未决事项）';
}

describe('压缩 evals（arch §7）：长会话压缩后未决事项仍可被后续问答召回', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
  });

  it('长会话触发压缩，压缩结果当 history 喂给下一轮，追问能召回未决事项', async () => {
    const longHistory: ChatMessage[] = [
      { role: 'user', content: `提醒我一下，${PENDING_ITEM}。${FILLER}` },
      { role: 'assistant', content: `记下了，${FILLER}` },
      ...Array.from({ length: 14 }, (_, i): ChatMessage => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `第 ${i} 轮不相关的闲聊。${FILLER}`,
      })),
    ];

    expect(needsCompression(longHistory)).toBe(true);

    const compressed = await compressHistory(longHistory, summarize);
    expect(compressed.compressed).toBe(true);
    expect(compressed.summary).toContain('张总');
    expect(compressed.summary).toContain('合同');

    // 追问："我还有什么欠着的事吗？"——用一个只看得懂"压缩结果里有没有这件事"的脚本化驱动模拟召回
    const recallDriver: LlmDriver = async (messages) => {
      const wholeContext = messages.map((m) => m.content).join('\n');
      const recalled = wholeContext.includes('张总') && wholeContext.includes('合同');
      return {
        text: recalled ? '提醒你：还欠张总那份合同的审批跟进，别忘了周五前处理。' : '暂时没看到什么欠着的事。',
        toolCalls: [],
      };
    };

    const result = await runChat(
      '我还有什么欠着的事吗？',
      compressed.messages,
      { registry: createDefaultToolRegistry(), llm: recallDriver, defaultModel: 'mock', existingTasks: [] },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('张总');
    expect(result.text).toContain('合同');
  });

  it('对照组：如果压缩摘要没提到未决事项，追问就召回不到（证明断言不是摆设）', async () => {
    const historyWithoutPending: ChatMessage[] = Array.from({ length: 16 }, (_, i): ChatMessage => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `第 ${i} 轮不相关的闲聊。${FILLER}`,
    }));

    const compressed = await compressHistory(historyWithoutPending, summarize);
    expect(compressed.compressed).toBe(true);
    expect(compressed.summary).not.toContain('张总');

    const recallDriver: LlmDriver = async (messages) => {
      const wholeContext = messages.map((m) => m.content).join('\n');
      const recalled = wholeContext.includes('张总') && wholeContext.includes('合同');
      return { text: recalled ? '提醒你：张总合同的事。' : '暂时没看到什么欠着的事。', toolCalls: [] };
    };

    const result = await runChat(
      '我还有什么欠着的事吗？',
      compressed.messages,
      { registry: createDefaultToolRegistry(), llm: recallDriver, defaultModel: 'mock', existingTasks: [] },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe('暂时没看到什么欠着的事。');
  });
});
