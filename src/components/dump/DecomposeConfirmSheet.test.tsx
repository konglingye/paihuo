import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecomposeConfirmSheet } from './DecomposeConfirmSheet';
import type { DecomposerOutput } from '@/src/agents/profiles/decomposer';

const OUTPUT: DecomposerOutput = {
  tasks: [
    { localId: 'n1', title: '整理会议纪要', type: 'write', fit: 'full', saveMin: 40, due: { text: '今天 18:00', hot: true } },
    { localId: 'n2', title: '发布会 PPT', type: 'slide', fit: 'assist', saveMin: 90 },
  ],
  groups: [],
  relates: [],
};

describe('DecomposeConfirmSheet', () => {
  it('AI 识别出 due 的任务自动预填，展示"AI 识别到"提示', () => {
    render(<DecomposeConfirmSheet open output={OUTPUT} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByLabelText('整理会议纪要 截止时间') as HTMLInputElement;
    expect(input.value).toBe('今天 18:00');
    expect(screen.getByText(/AI 识别到「今天 18:00」/)).toBeInTheDocument();
  });

  it('没识别出 due 的任务留空且高亮提醒，未处理时"确认创建"按钮禁用', () => {
    render(<DecomposeConfirmSheet open output={OUTPUT} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByLabelText('发布会 PPT 截止时间') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByRole('button', { name: /确认创建 2 件活儿/ })).toBeDisabled();
  });

  it('手动补上截止时间后，按钮变可用；确认后回传补全的 due', () => {
    const onConfirm = vi.fn();
    render(<DecomposeConfirmSheet open output={OUTPUT} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('发布会 PPT 截止时间'), { target: { value: '周五之前' } });
    expect(screen.getByRole('button', { name: /确认创建 2 件活儿/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /确认创建 2 件活儿/ }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          expect.objectContaining({ title: '整理会议纪要', due: { text: '今天 18:00', hot: true } }),
          expect.objectContaining({ title: '发布会 PPT', due: { text: '周五之前', hot: false } }),
        ],
      }),
    );
  });

  it('勾"不用填"就算没填字也能确认，回传的 due 是 undefined', () => {
    const onConfirm = vi.fn();
    render(<DecomposeConfirmSheet open output={OUTPUT} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('发布会 PPT 不用填截止时间'));
    expect(screen.getByRole('button', { name: /确认创建 2 件活儿/ })).toBeEnabled();
    expect(screen.getByLabelText('发布会 PPT 截止时间')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /确认创建 2 件活儿/ }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([expect.objectContaining({ title: '发布会 PPT', due: undefined })]),
      }),
    );
  });

  it('点"取消"调用 onCancel，不调用 onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DecomposeConfirmSheet open output={OUTPUT} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('output 为 null 时不渲染任务行，也不报错', () => {
    render(<DecomposeConfirmSheet open output={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText(/截止时间/)).not.toBeInTheDocument();
  });
});
