import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore, useUiStore } from '@/src/store';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useUiStore.setState({ activeTab: 'overview', chatOpen: false, settingsOpen: false, reveal: null, notification: null });
    useTasksStore.setState({ tasks: {} });
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
});
