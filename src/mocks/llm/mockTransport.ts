import { LlmError, type StreamChatCompletion } from '@/src/llm/types';
import { findFixture } from './fixtures';

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
  const chunks = fixture.respond ? fixture.respond(lastUserMessage) : (fixture.chunks ?? []);

  let content = '';
  for (const chunk of chunks) {
    await delay(fixture.delayMs ?? 10, signal);
    content += chunk;
    callbacks.onDelta?.(chunk);
  }
  if (fixture.usage) callbacks.onUsage?.(fixture.usage);
  return { content, usage: fixture.usage };
};
