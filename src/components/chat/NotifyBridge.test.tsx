import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/src/components/ui';
import { useUiStore } from '@/src/store';
import { NotifyBridge } from './NotifyBridge';

describe('NotifyBridge', () => {
  beforeEach(() => {
    useUiStore.setState({ notification: null });
  });

  it('uiStore.notify 触发后会显示对应文本的 toast', () => {
    render(
      <ToastProvider>
        <NotifyBridge />
      </ToastProvider>,
    );
    act(() => {
      useUiStore.getState().notify('活儿有点多，喝口水');
    });
    expect(screen.getByText('活儿有点多，喝口水')).toBeInTheDocument();
  });

  it('同样的文本再 notify 一次也会重新显示（nonce 变了）', () => {
    render(
      <ToastProvider>
        <NotifyBridge />
      </ToastProvider>,
    );
    act(() => {
      useUiStore.getState().notify('提醒 A');
    });
    expect(screen.getByText('提醒 A')).toBeInTheDocument();
    act(() => {
      useUiStore.getState().notify('提醒 B');
    });
    expect(screen.getByText('提醒 B')).toBeInTheDocument();
  });
});
