import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatDock } from './ChatDock';

describe('ChatDock', () => {
  it('渲染快捷 chips 和输入条', () => {
    render(<ChatDock busy={false} onSend={() => {}} />);
    expect(screen.getByRole('button', { name: '会议纪要发完了' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PPT 不知道从哪下手' })).toBeInTheDocument();
    expect(screen.getByLabelText('对话输入')).toBeInTheDocument();
  });

  it('点击快捷 chip 直接发送对应文本', () => {
    const onSend = vi.fn();
    render(<ChatDock busy={false} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: '会议纪要发完了' }));
    expect(onSend).toHaveBeenCalledWith('会议纪要发完了');
  });

  it('在输入框打字并提交会发送并清空输入框', () => {
    const onSend = vi.fn();
    render(<ChatDock busy={false} onSend={onSend} />);
    const input = screen.getByLabelText('对话输入') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '随便问点什么' } });
    fireEvent.click(screen.getByLabelText('发送'));
    expect(onSend).toHaveBeenCalledWith('随便问点什么');
    expect(input.value).toBe('');
  });

  it('busy 时发送按钮禁用，不会触发 onSend', () => {
    const onSend = vi.fn();
    render(<ChatDock busy={true} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: '会议纪要发完了' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText('发送')).toBeDisabled();
  });

  it('空输入不触发发送', () => {
    const onSend = vi.fn();
    render(<ChatDock busy={false} onSend={onSend} />);
    fireEvent.click(screen.getByLabelText('发送'));
    expect(onSend).not.toHaveBeenCalled();
  });
});
