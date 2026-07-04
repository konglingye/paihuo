import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';
import { MODEL_PRESETS } from '@/src/llm/presets';
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
      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'paihuo:settings',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
