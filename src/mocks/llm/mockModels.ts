import type { ModelInfo } from '@/src/llm/models';

/** 按 base_url 关键词模拟各预设的模型列表，覆盖推理/非推理混合场景 */
function modelsFor(baseUrl: string): ModelInfo[] {
  if (baseUrl.includes('deepseek')) {
    return [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }];
  }
  if (baseUrl.includes('moonshot')) {
    return [{ id: 'moonshot-v1-8k' }, { id: 'kimi-thinking-preview' }];
  }
  if (baseUrl.includes('bigmodel')) {
    return [{ id: 'glm-4' }, { id: 'glm-z1-flash' }];
  }
  if (baseUrl.includes('volces')) {
    return [{ id: 'doubao-pro-32k' }, { id: 'doubao-seed-1-6-thinking' }];
  }
  return [{ id: 'mock-model' }];
}

export async function mockFetchModelList(params: { baseUrl: string }): Promise<ModelInfo[]> {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return modelsFor(params.baseUrl);
}
