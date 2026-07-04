import { LlmError } from './types';
import { isMockMode } from '@/src/mocks/env';
import { mockFetchModelList } from '@/src/mocks/llm/mockModels';

export interface ModelInfo {
  id: string;
}

interface RawModelListResponse {
  data?: { id: string }[];
  models?: { id: string }[];
}

function classifyHttpError(status: number, bodyText: string): LlmError {
  let message = bodyText || `HTTP ${status}`;
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    // 非 JSON body，原样使用文本
  }
  if (status === 401 || status === 403) return new LlmError('unauthorized', message, status);
  if (status === 429) return new LlmError('rate_limited', message, status);
  return new LlmError('unknown', message, status);
}

/** 兼容带/不带 /v1 的 base_url 写法，先试最可能对的那个，再探测回退到另一个（spec §3.4） */
function candidateUrls(baseUrl: string): string[] {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) {
    return [`${trimmed}/models`, `${trimmed}/v1/models`];
  }
  return [`${trimmed}/v1/models`, `${trimmed}/models`];
}

async function fetchModelListReal(
  params: { baseUrl: string; apiKey: string },
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  const urls = candidateUrls(params.baseUrl);
  let lastError: LlmError = new LlmError('network', '无法获取模型列表');

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
        signal,
      });
      if (!response.ok) {
        lastError = classifyHttpError(response.status, await response.text());
        continue;
      }
      const json = (await response.json()) as RawModelListResponse;
      const list = json.data ?? json.models ?? [];
      return list.map((m) => ({ id: m.id }));
    } catch (err) {
      if (err instanceof LlmError) {
        lastError = err;
      } else if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmError('aborted', '已取消');
      } else {
        lastError = new LlmError('network', err instanceof Error ? err.message : String(err));
      }
    }
  }

  throw lastError;
}

export async function fetchModelList(
  params: { baseUrl: string; apiKey: string },
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  return isMockMode() ? mockFetchModelList(params) : fetchModelListReal(params, signal);
}
