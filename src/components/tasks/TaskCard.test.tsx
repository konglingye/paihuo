import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';
import { useTasksStore, useUiStore } from '@/src/store';
import { ToastProvider } from '@/src/components/ui';
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

function renderCard(props: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  return render(
    <ToastProvider>
      <TaskCard taskId={baseTask.id} toolName="豆包" toolUrl="https://www.doubao.com" {...props} />
    </ToastProvider>,
  );
}

describe('TaskCard', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: { [baseTask.id]: baseTask } });
    useUiStore.setState({ reveal: null });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('渲染标题、due pill、fit pill、类型 tag', () => {
    renderCard();
    expect(screen.getByText(baseTask.title)).toBeInTheDocument();
    expect(screen.getByText('今天 18:00')).toBeInTheDocument();
    expect(screen.getByText('AI 可代劳')).toBeInTheDocument();
    expect(screen.getByText('写作')).toBeInTheDocument();
    expect(screen.getByText('豆包')).toBeInTheDocument();
  });

  it('默认收起，点击展开显示说明和提示词，空槽高亮渲染', () => {
    renderCard();
    expect(screen.queryByText('下午渠道会的结论和待办')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

    expect(screen.getByText('下午渠道会的结论和待办')).toBeInTheDocument();
    expect(screen.getByText('【粘贴转写文字】').tagName).toBe('MARK');
  });

  it('fit=full 展开后主按钮显示"复制提示词 · 打开 {工具}"', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
    expect(screen.getByRole('button', { name: /复制提示词 · 打开 豆包/ })).toBeInTheDocument();
  });

  it('fit=self 展开后主按钮显示"复制小抄"', () => {
    const selfTask: Task = { ...baseTask, id: 't2', fit: 'self', toolId: undefined };
    useTasksStore.setState({ tasks: { [selfTask.id]: selfTask } });
    renderCard({ taskId: selfTask.id, toolName: undefined, toolUrl: undefined });
    fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
    expect(screen.getByRole('button', { name: '复制小抄' })).toBeInTheDocument();
  });

  it('点击复选框标记完成，标题划线，操作区消失', () => {
    renderCard();
    fireEvent.click(screen.getByRole('checkbox', { name: '标记完成' }));

    expect(useTasksStore.getState().tasks[baseTask.id].status).toBe('done');
    expect(screen.getByText(baseTask.title)).toHaveClass('line-through');
  });

  it('标记完成时在卡片内临时插入几个"粒子"节点做完成动效', () => {
    const { container } = renderCard();
    const before = container.querySelectorAll('span').length;
    fireEvent.click(screen.getByRole('checkbox', { name: '标记完成' }));
    const after = container.querySelectorAll('span').length;
    expect(after).toBeGreaterThan(before);
  });

  it('任务不存在时不渲染任何内容', () => {
    const { container } = render(
      <ToastProvider>
        <TaskCard taskId="not-exist" />
      </ToastProvider>,
    );
    expect(container.querySelector('article')).toBeNull();
  });

  describe('复制提示词 · 打开工具（fit != self）', () => {
    it('点击后复制提示词到剪贴板、打开工具站点、按钮短暂切到已复制态、弹 toast', async () => {
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
      renderCard();
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

      fireEvent.click(screen.getByRole('button', { name: /复制提示词 · 打开 豆包/ }));

      // 点击处理是 async 的（先 await 剪贴板写入再开 tab），等已复制态出现再断言副作用
      expect(await screen.findByText(/已复制 · 真实插件会顺手打开 豆包/)).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseTask.prompt);
      expect(createSpy).toHaveBeenCalledWith({ url: 'https://www.doubao.com' });
      expect(await screen.findByText(/提示词已复制 — 粘贴到 豆包 就能用/)).toBeInTheDocument();
      createSpy.mockRestore();
    });
  });

  describe('reveal_card 高亮（uiStore.reveal）', () => {
    it('reveal.taskId 命中本卡时自动展开、滚动进视野、加高亮样式', () => {
      const { container } = renderCard();
      act(() => {
        useUiStore.getState().revealTask(baseTask.id);
      });

      expect(screen.getByText('下午渠道会的结论和待办')).toBeInTheDocument(); // 已展开
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(container.querySelector('article')).toHaveClass('border-[rgba(61,111,252,.55)]');
    });

    it('高亮一段时间后自动消退', () => {
      vi.useFakeTimers();
      const { container } = renderCard();
      act(() => {
        useUiStore.getState().revealTask(baseTask.id);
      });
      expect(container.querySelector('article')).toHaveClass('border-[rgba(61,111,252,.55)]');

      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(container.querySelector('article')).not.toHaveClass('border-[rgba(61,111,252,.55)]');
      vi.useRealTimers();
    });

    it('reveal.taskId 指向别的任务时不高亮', () => {
      const { container } = renderCard();
      act(() => {
        useUiStore.getState().revealTask('other-task');
      });
      expect(container.querySelector('article')).not.toHaveClass('border-[rgba(61,111,252,.55)]');
    });
  });

  describe('复制小抄（fit === self）', () => {
    it('点击后只复制，不打开任何 tab', async () => {
      const selfTask: Task = { ...baseTask, id: 't3', fit: 'self', toolId: undefined };
      useTasksStore.setState({ tasks: { [selfTask.id]: selfTask } });
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
      renderCard({ taskId: selfTask.id, toolName: undefined, toolUrl: undefined });
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

      fireEvent.click(screen.getByRole('button', { name: '复制小抄' }));

      expect(await screen.findByText('小抄已复制')).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(selfTask.prompt);
      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('删除任务（真实反馈：之前只能标记完成，没有真正删除的办法）', () => {
    it('展开后能看到删除入口，点一下先要求二次确认，不会一点就删', () => {
      renderCard();
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

      fireEvent.click(screen.getByRole('button', { name: '删除这件活儿' }));

      expect(useTasksStore.getState().tasks[baseTask.id]).toBeDefined();
      expect(screen.getByText(/确定要删除/)).toBeInTheDocument();
    });

    it('二次确认后才真正从 store 里移除', () => {
      renderCard();
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
      fireEvent.click(screen.getByRole('button', { name: '删除这件活儿' }));

      fireEvent.click(screen.getByRole('button', { name: '确定删除' }));

      expect(useTasksStore.getState().tasks[baseTask.id]).toBeUndefined();
    });

    it('点"取消"退回正常状态，不删除', () => {
      renderCard();
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));
      fireEvent.click(screen.getByRole('button', { name: '删除这件活儿' }));

      fireEvent.click(screen.getByRole('button', { name: '取消' }));

      expect(useTasksStore.getState().tasks[baseTask.id]).toBeDefined();
      expect(screen.queryByText(/确定要删除/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '删除这件活儿' })).toBeInTheDocument();
    });

    it('已完成的任务也能删除（不是只有待办才能删）', () => {
      const doneTask: Task = { ...baseTask, id: 't4', status: 'done', doneAt: 1000 };
      useTasksStore.setState({ tasks: { [doneTask.id]: doneTask } });
      renderCard({ taskId: doneTask.id });
      fireEvent.click(screen.getByRole('button', { name: /整理今天的会议纪要/ }));

      fireEvent.click(screen.getByRole('button', { name: '删除这件活儿' }));
      fireEvent.click(screen.getByRole('button', { name: '确定删除' }));

      expect(useTasksStore.getState().tasks[doneTask.id]).toBeUndefined();
    });
  });
});
