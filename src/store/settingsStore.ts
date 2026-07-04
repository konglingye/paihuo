import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import { MODEL_PRESETS } from '@/src/llm/presets';
import { eventBus } from '@/src/agents/events';
import type { Settings } from './schema';

const DEFAULT_PRESET = MODEL_PRESETS[0];

/** 默认预选 DeepSeek（推荐），对应原型 .preset.sel 的默认态 */
export const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_PRESET.baseUrl,
  apiKey: '',
  model: '',
  presetId: DEFAULT_PRESET.id,
};

interface SettingsState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
        // settings.changed 事件（arch §5）：目前没有模型探测缓存需要失效，机制先接好，留给以后加缓存时用
        void eventBus.emit({ type: 'settings.changed' });
      },
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'paihuo:settings',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
