import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_SETTINGS, useSettingsStore } from './settingsStore';
import { SCHEMA_VERSION } from './version';

describe('settingsStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
  });

  it('初始值为 DEFAULT_SETTINGS', () => {
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('setSettings 局部更新并保留其余字段', () => {
    useSettingsStore.getState().setSettings({ baseUrl: 'https://api.deepseek.com', presetId: 'deepseek' });
    useSettingsStore.getState().setSettings({ apiKey: 'sk-test' });
    expect(useSettingsStore.getState().settings).toMatchObject({
      baseUrl: 'https://api.deepseek.com',
      presetId: 'deepseek',
      apiKey: 'sk-test',
    });
  });

  it('resetSettings 恢复默认值', () => {
    useSettingsStore.getState().setSettings({ apiKey: 'sk-test' });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态（模拟重启扩展）', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:settings': JSON.stringify({
        state: {
          settings: {
            baseUrl: 'https://api.deepseek.com',
            apiKey: 'sk-test',
            model: 'deepseek-reasoner',
            presetId: 'deepseek',
          },
        },
        version: SCHEMA_VERSION,
      }),
    });

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().settings).toMatchObject({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-reasoner',
      presetId: 'deepseek',
    });
  });
});
