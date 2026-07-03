import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './uiStore';

const INITIAL = {
  activeTab: 'overview',
  taskFilter: 'all',
  chatOpen: false,
  settingsOpen: false,
} as const;

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState(INITIAL);
  });

  it('初始状态为总览 tab、全部筛选、抽屉全关', () => {
    expect(useUiStore.getState()).toMatchObject(INITIAL);
  });

  it('setActiveTab 切换当前 tab', () => {
    useUiStore.getState().setActiveTab('jobs');
    expect(useUiStore.getState().activeTab).toBe('jobs');
  });

  it('setTaskFilter 切换任务类型筛选', () => {
    useUiStore.getState().setTaskFilter('slide');
    expect(useUiStore.getState().taskFilter).toBe('slide');
  });

  it('openChat/closeChat 控制对话抽屉', () => {
    useUiStore.getState().openChat();
    expect(useUiStore.getState().chatOpen).toBe(true);
    useUiStore.getState().closeChat();
    expect(useUiStore.getState().chatOpen).toBe(false);
  });

  it('openSettings/closeSettings 控制设置抽屉', () => {
    useUiStore.getState().openSettings();
    expect(useUiStore.getState().settingsOpen).toBe(true);
    useUiStore.getState().closeSettings();
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });
});
