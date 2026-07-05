import { describe, expect, it } from 'vitest';
import { MODEL_PRESETS, getPreset } from './presets';
import { isReasoningModel } from './reasoningModel';

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

  it('DeepSeek 白名单覆盖 v4 新模型名（deepseek-chat/deepseek-reasoner 将于 2026-07-24 下线，合并进 deepseek-v4-flash，默认思考模式）', () => {
    const deepseek = getPreset('deepseek');
    expect(deepseek?.reasoningWhitelist).toEqual(
      expect.arrayContaining(['deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro']),
    );
  });

  it('接上 isReasoningModel：deepseek-v4-flash/pro 判定为推理模型，正则本身不认识 flash/pro 这两个词', () => {
    const deepseek = getPreset('deepseek');
    expect(isReasoningModel('deepseek-v4-flash', deepseek?.reasoningWhitelist)).toBe(true);
    expect(isReasoningModel('deepseek-v4-pro', deepseek?.reasoningWhitelist)).toBe(true);
  });
});
