import { isMockMode } from '@/src/mocks/env';
import { mockStreamChatCompletion } from '@/src/mocks/llm/mockTransport';
import { realStreamChatCompletion } from './realTransport';
import type { StreamChatCompletion } from './types';

/**
 * 统一入口：harness 与所有上层代码只应该调用这里，不直接碰 transport/mock 实现。
 * mock 模式（VITE_PAIHUO_MOCK=1）下不发起任何真实网络请求。
 */
export const streamChatCompletion: StreamChatCompletion = (params, callbacks, signal) => {
  const impl = isMockMode() ? mockStreamChatCompletion : realStreamChatCompletion;
  return impl(params, callbacks, signal);
};
