export interface ModelPreset {
  id: string;
  label: string;
  baseUrl: string;
  registerUrl: string | null;
  tip: string;
  /** 明确覆盖推理模型识别（不管正则），命中即视为推理模型 */
  reasoningWhitelist?: string[];
}

/** 平台预设表（spec §3.4），执行 T12 之外还需人工核验各家 base_url 是否仍然可用 */
export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek · 推荐',
    baseUrl: 'https://api.deepseek.com',
    registerUrl: 'https://platform.deepseek.com',
    tip: 'DeepSeek：手机号就能注册，新用户送免费额度；之后一次拆解也就几分钱。',
    reasoningWhitelist: ['deepseek-reasoner'],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    registerUrl: 'https://platform.moonshot.cn',
    tip: 'Kimi 月之暗面：长文本能力强，适合读长会议记录、写长文案。',
  },
  {
    id: 'glm',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    registerUrl: 'https://open.bigmodel.cn',
    tip: '智谱 GLM：国产老牌，模型选择多。',
  },
  {
    id: 'doubao',
    label: '豆包·方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    registerUrl: 'https://console.volcengine.com/ark',
    tip: '豆包·火山方舟：字节的模型平台，中文对话体验好。',
  },
  {
    id: 'custom',
    label: '自定义',
    baseUrl: '',
    registerUrl: null,
    tip: '自己填 base_url，兼容 OpenAI 接口格式的平台都能接。',
  },
];

export function getPreset(id: string): ModelPreset | undefined {
  return MODEL_PRESETS.find((p) => p.id === id);
}
