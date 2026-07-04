import { LlmError, type StreamChatCompletion } from '@/src/llm/types';
import { findFixture, type LlmFixtureStep } from './fixtures';

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LlmError('aborted', '已取消'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new LlmError('aborted', '已取消'));
      },
      { once: true },
    );
  });
}

/** mock 通道：读 fixtures 模拟分片流式，行为契约与 transport.ts 的真实实现一致，可直接互换 */
export const mockStreamChatCompletion: StreamChatCompletion = async (params, callbacks, signal) => {
  if (signal?.aborted) throw new LlmError('aborted', '已取消');

  const lastUserMessage = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const fixture = findFixture(lastUserMessage);
  const steps: LlmFixtureStep[] = fixture.steps ?? [{ chunks: fixture.chunks, respond: fixture.respond }];
  // 多轮剧本按"已经拿到的 tool 结果数"选对应 step——每次都重新 match 同一个 fixture，靠这个数区分轮次
  const toolResultCount = params.messages.filter((m) => m.role === 'tool').length;
  const step = steps[Math.min(toolResultCount, steps.length - 1)];

  const chunks = step.respond ? step.respond(lastUserMessage, params.messages) : (step.chunks ?? []);

  let content = '';
  for (const chunk of chunks) {
    await delay(fixture.delayMs ?? 10, signal);
    content += chunk;
    callbacks.onDelta?.(chunk);
  }
  if (fixture.usage) callbacks.onUsage?.(fixture.usage);

  const rawToolCalls = typeof step.toolCalls === 'function' ? step.toolCalls(lastUserMessage, params.messages) : (step.toolCalls ?? []);
  const toolCalls = rawToolCalls.length
    ? rawToolCalls.map((tc, i) => ({ id: `mock-tool-${toolResultCount}-${i}`, name: tc.name, arguments: JSON.stringify(tc.args) }))
    : undefined;

  return { content, usage: fixture.usage, toolCalls };
};
