import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './uiStore';

const INITIAL = {
  activeTab: 'overview',
  taskFilter: 'all',
  chatOpen: false,
  settingsOpen: false,
  reveal: null,
  notification: null,
  pendingChatPrompt: null,
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

  it('revealTask 切到活儿 tab 并记录目标任务 id，nonce 递增', () => {
    useUiStore.getState().setActiveTab('report');
    useUiStore.getState().revealTask('t1');
    expect(useUiStore.getState().activeTab).toBe('jobs');
    expect(useUiStore.getState().reveal).toMatchObject({ taskId: 't1', nonce: 1 });

    useUiStore.getState().revealTask('t1');
    expect(useUiStore.getState().reveal).toMatchObject({ taskId: 't1', nonce: 2 });
  });

  it('notify 记录待展示的提醒文本，nonce 递增（同样的文本也能重新触发）', () => {
    useUiStore.getState().notify('活儿有点多，喝口水');
    expect(useUiStore.getState().notification).toMatchObject({ text: '活儿有点多，喝口水', nonce: 1 });

    useUiStore.getState().notify('活儿有点多，喝口水');
    expect(useUiStore.getState().notification).toMatchObject({ text: '活儿有点多，喝口水', nonce: 2 });
  });

  it('requestChatPrompt 记录待发送的对话内容，nonce 递增（同样的文本也能重新触发）——关联横幅"好，先定关键信息"用这个真正把话捎给小派', () => {
    useUiStore.getState().requestChatPrompt('帮我理一下这几件事的关键信息');
    expect(useUiStore.getState().pendingChatPrompt).toMatchObject({
      text: '帮我理一下这几件事的关键信息',
      nonce: 1,
    });

    useUiStore.getState().requestChatPrompt('帮我理一下这几件事的关键信息');
    expect(useUiStore.getState().pendingChatPrompt).toMatchObject({
      text: '帮我理一下这几件事的关键信息',
      nonce: 2,
    });
  });
});
