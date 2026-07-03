import { browser } from 'wxt/browser';
import type { StateStorage } from 'zustand/middleware';

/** zustand persist 的 StateStorage 适配器，落地到 chrome.storage.local */
export const chromeStorage: StateStorage = {
  getItem: async (name) => {
    const result = await browser.storage.local.get(name);
    const value = result[name];
    return typeof value === 'string' ? value : null;
  },
  setItem: async (name, value) => {
    await browser.storage.local.set({ [name]: value });
  },
  removeItem: async (name) => {
    await browser.storage.local.remove(name);
  },
};
