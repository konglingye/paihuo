import { describe, expect, it } from 'vitest';
import { isReasoningModel } from './reasoningModel';

describe('isReasoningModel', () => {
  it.each([
    'deepseek-reasoner',
    'kimi-thinking-preview',
    'glm-z1-flash',
    'doubao-seed-1-6-thinking',
    'qwq-32b',
    'o1-preview',
    'o3-mini',
    'o4-mini',
    'gpt-5',
    'some-r1-model',
    'r1-distill',
  ])('%s 识别为推理模型', (modelId) => {
    expect(isReasoningModel(modelId)).toBe(true);
  });

  it.each(['deepseek-chat', 'moonshot-v1-8k', 'glm-4', 'doubao-pro-32k', 'gpt-4o'])(
    '%s 识别为非推理模型',
    (modelId) => {
      expect(isReasoningModel(modelId)).toBe(false);
    },
  );

  it('预设的 reasoningWhitelist 精确覆盖，不管正则怎么判', () => {
    expect(isReasoningModel('my-custom-smart-model', ['my-custom-smart-model'])).toBe(true);
    expect(isReasoningModel('deepseek-chat', ['deepseek-chat'])).toBe(true);
  });
});
