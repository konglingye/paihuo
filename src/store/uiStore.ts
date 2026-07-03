import { create } from 'zustand';
import type { TaskType } from './schema';

export type ActiveTab = 'overview' | 'jobs' | 'report';
export type TaskFilter = TaskType | 'all';

interface UiState {
  activeTab: ActiveTab;
  taskFilter: TaskFilter;
  chatOpen: boolean;
  settingsOpen: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  setTaskFilter: (filter: TaskFilter) => void;
  openChat: () => void;
  closeChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

/** 纯瞬态 UI 状态，不落盘——每次打开侧边栏都从总览 tab 重新开始 */
export const useUiStore = create<UiState>((set) => ({
  activeTab: 'overview',
  taskFilter: 'all',
  chatOpen: false,
  settingsOpen: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTaskFilter: (filter) => set({ taskFilter: filter }),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
