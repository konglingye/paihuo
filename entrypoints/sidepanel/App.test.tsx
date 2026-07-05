import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useCaptureStore, useTasksStore, useUiStore } from '@/src/store';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useUiStore.setState({
      activeTab: 'overview',
      chatOpen: false,
      settingsOpen: false,
      reveal: null,
      notification: null,
      pendingChatPrompt: null,
    });
    useTasksStore.setState({ tasks: {} });
    useCaptureStore.setState({ pendingText: null });
  });

  it('渲染总览/活儿/汇报三个 tab，默认选中总览', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: '总览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '活儿' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: '汇报' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText(/活儿还没倒进来/)).toBeInTheDocument();
  });

  it('点击「活儿」tab 切到倒活面板', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: '活儿' }));
    expect(screen.getByRole('tab', { name: '活儿' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('任务输入')).toBeInTheDocument();
  });

  it('uiStore.requestChatPrompt 打开对话抽屉并把话真的捎给小派——之前关联横幅点了按钮只开空对话框，没人说话', async () => {
    render(<App />);
    await act(async () => {
      useUiStore.getState().requestChatPrompt('帮我理一下「PPT」和「文案」共用的关键信息');
    });
    expect(useUiStore.getState().chatOpen).toBe(true);
    expect(screen.getByText('帮我理一下「PPT」和「文案」共用的关键信息')).toBeInTheDocument();
  });
});
