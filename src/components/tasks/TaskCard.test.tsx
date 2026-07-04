import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store';
import { TaskCard } from './TaskCard';
import type { Task } from '@/src/store/schema';

const baseTask: Task = {
  id: 't1',
  title: '整理今天的会议纪要，下班前发群里',
  type: 'write',
  fit: 'full',
  status: 'todo',
  saveMin: 40,
  fragmentId: 'f1',
  createdAt: 0,
  due: { text: '今天 18:00', hot: true },
  note: '下午渠道会的结论和待办',
  prompt: '把转写整理成纪要：\n转写原文：【粘贴转写文字】',
  toolId: 'doubao',
};

describe('TaskCard', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: { [baseTask.id]: baseTask } });
  });

  it('渲染标题、due pill、fit pill、类型 tag', () => {
    render(<TaskCard taskId={baseTask.id} toolName="豆包" />);
    expect(screen.getByText(baseTask.title)).toBeInTheDocument();
    expect(screen.getByText('今天 18:00')).toBeInTheDocument();
    expect(screen.getByText('AI 可代劳')).toBeInTheDocument();
    expect(screen.getByText('写作')).toBeInTheDocument();
    expect(screen.getByText('豆包')).toBeInTheDocument();
  });

  it('默认收起，点击展开显示说明和提示词，空槽高亮渲染', () => {
    render(<TaskCard taskId={baseTask.id} toolName="豆包" />);
    expect(screen.queryByText('下午渠道会的结论和待办')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

    expect(screen.getByText('下午渠道会的结论和待办')).toBeInTheDocument();
    expect(screen.getByText('【粘贴转写文字】').tagName).toBe('MARK');
  });

  it('fit=full 展开后主按钮显示"复制提示词 · 打开 {工具}"', () => {
    render(<TaskCard taskId={baseTask.id} toolName="豆包" />);
    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
    expect(screen.getByRole('button', { name: /复制提示词 · 打开 豆包/ })).toBeInTheDocument();
  });

  it('fit=self 展开后主按钮显示"复制小抄"', () => {
    const selfTask: Task = { ...baseTask, id: 't2', fit: 'self', toolId: undefined };
    useTasksStore.setState({ tasks: { [selfTask.id]: selfTask } });
    render(<TaskCard taskId={selfTask.id} />);
    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
    expect(screen.getByRole('button', { name: '复制小抄' })).toBeInTheDocument();
  });

  it('点击复选框标记完成，标题划线，操作区消失', () => {
    render(<TaskCard taskId={baseTask.id} toolName="豆包" />);
    fireEvent.click(screen.getByRole('checkbox', { name: '标记完成' }));

    expect(useTasksStore.getState().tasks[baseTask.id].status).toBe('done');
    expect(screen.getByText(baseTask.title)).toHaveClass('line-through');
  });

  it('任务不存在时不渲染任何内容', () => {
    const { container } = render(<TaskCard taskId="not-exist" />);
    expect(container).toBeEmptyDOMElement();
  });
});
