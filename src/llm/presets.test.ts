import { describe, expect, it } from 'vitest';
import { MODEL_PRESETS, getPreset } from './presets';

describe('MODEL_PRESETS', () => {
  it('包含 spec §3.4 的 5 个预设，DeepSeek 排第一（推荐）', () => {
    expect(MODEL_PRESETS.map((p) => p.id)).toEqual(['deepseek', 'kimi', 'glm', 'doubao', 'custom']);
  });

  it('除自定义外，每个预设都有 baseUrl 和注册页', () => {
    MODEL_PRESETS.filter((p) => p.id !== 'custom').forEach((p) => {
      expect(p.baseUrl).toMatch(/^https:\/\//);
      expect(p.registerUrl).toMatch(/^https:\/\//);
    });
  });

  it('自定义预设没有固定 baseUrl/注册页', () => {
    const custom = getPreset('custom');
    expect(custom?.baseUrl).toBe('');
    expect(custom?.registerUrl).toBeNull();
  });

  it('getPreset 找不到时返回 undefined', () => {
    expect(getPreset('not-exist')).toBeUndefined();
  });
});
