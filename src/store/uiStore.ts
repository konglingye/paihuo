import { create } from 'zustand';
import type { TaskType } from './schema';

export type ActiveTab = 'overview' | 'jobs' | 'report';
export type TaskFilter = TaskType | 'all';

interface RevealState {
  taskId: string;
  /** 每次 revealTask 递增，即便目标是同一张卡也要能重新触发一次高亮动效 */
  nonce: number;
}

interface NotificationState {
  text: string;
  /** 每次 notify 递增，即便文本相同也要能重新触发一次 toast */
  nonce: number;
}

interface UiState {
  activeTab: ActiveTab;
  taskFilter: TaskFilter;
  chatOpen: boolean;
  settingsOpen: boolean;
  reveal: RevealState | null;
  notification: NotificationState | null;
  setActiveTab: (tab: ActiveTab) => void;
  setTaskFilter: (filter: TaskFilter) => void;
  openChat: () => void;
  closeChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  /** reveal_card 工具用：跳去活儿 tab 并高亮指定任务卡（T14） */
  revealTask: (taskId: string) => void;
  /** notify 工具用：不依赖 React context 就能从 agent 工具层触发一条 toast（T14） */
  notify: (text: string) => void;
}

/** 纯瞬态 UI 状态，不落盘——每次打开侧边栏都从总览 tab 重新开始 */
export const useUiStore = create<UiState>((set) => ({
  activeTab: 'overview',
  taskFilter: 'all',
  chatOpen: false,
  settingsOpen: false,
  reveal: null,
  notification: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTaskFilter: (filter) => set({ taskFilter: filter }),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  revealTask: (taskId) =>
    set((s) => ({ activeTab: 'jobs', reveal: { taskId, nonce: (s.reveal?.nonce ?? 0) + 1 } })),
  notify: (text) => set((s) => ({ notification: { text, nonce: (s.notification?.nonce ?? 0) + 1 } })),
}));
