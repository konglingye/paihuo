import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';

interface CaptureState {
  pendingText: string | null;
  /** 右键菜单（background 上下文）写入选中文本 */
  setPendingText: (text: string) => void;
  /** sidepanel 挂载时取走文本并清空，避免同一段文本被消费两次 */
  takePendingText: () => string | null;
}

/**
 * 右键收集中转站（spec §7）：background 的 contextMenus 处理器和 sidepanel 是两个不共享内存的
 * JS 上下文，选中的文本得经 chrome.storage.local 这一跳才能从右键菜单传到倒活框。
 */
export const useCaptureStore = create<CaptureState>()(
  persist(
    (set, get) => ({
      pendingText: null,
      setPendingText: (text) => set({ pendingText: text }),
      takePendingText: () => {
        const text = get().pendingText;
        if (text !== null) set({ pendingText: null });
        return text;
      },
    }),
    {
      name: 'paihuo:capture',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
