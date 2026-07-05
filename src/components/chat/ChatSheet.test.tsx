import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store';
import { ToastProvider } from '@/src/components/ui';
import { ChatSheet, type ChatSheetProps } from './ChatSheet';
import type { ChatMessageVM } from './useOrchestratorChat';

const MESSAGES: ChatMessageVM[] = [
  { id: 'm1', role: 'user', text: '会议纪要发完了' },
  { id: 'm2', role: 'bot', text: '真棒，这件事我先帮你划掉。' },
];

function renderSheet(props: Partial<ChatSheetProps> = {}) {
  return render(
    <ToastProvider>
      <ChatSheet open messages={[]} busy={false} activity={null} onSend={() => {}} onClose={() => {}} {...props} />
    </ToastProvider>,
  );
}

describe('ChatSheet', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({
      tasks: {
        t1: {
          id: 't1',
          title: '发布会 PPT',
          type: 'slide',
          fit: 'assist',
          status: 'todo',
          saveMin: 90,
          fragmentId: 'f1',
          createdAt: 0,
        },
        t2: {
          id: 't2',
          title: '已完成的活儿',
          type: 'misc',
          fit: 'self',
          status: 'done',
          saveMin: 0,
          fragmentId: 'f1',
          createdAt: 0,
        },
      },
    });
  });

  it('头部状态文案里显示未完成任务数（不含已完成的）', () => {
    renderSheet();
    expect(screen.getByText('在线 · 手里记着 1 件活儿')).toBeInTheDocument();
  });

  it('还没有消息时显示空态提示，引导开口说点什么', () => {
    renderSheet();
    expect(screen.getByText(/跟小派说点什么/)).toBeInTheDocument();
  });

  it('有消息之后不再显示空态提示', () => {
    renderSheet({ messages: MESSAGES });
    expect(screen.queryByText(/跟小派说点什么/)).not.toBeInTheDocument();
  });

  it('渲染用户/助手消息气泡', () => {
    renderSheet({ messages: MESSAGES });
    expect(screen.getByText('会议纪要发完了')).toBeInTheDocument();
    expect(screen.getByText('真棒，这件事我先帮你划掉。')).toBeInTheDocument();
  });

  it('busy 且最后一条 bot 消息还是空文本时显示打字点+活动短句，不渲染额外的空气泡', () => {
    const streamingMessages: ChatMessageVM[] = [...MESSAGES, { id: 'm3', role: 'user', text: 'PPT 怎么开始' }, { id: 'm4', role: 'bot', text: '' }];
    renderSheet({ messages: streamingMessages, busy: true, activity: '正在带你去看那张卡…' });
    expect(screen.getByText('正在带你去看那张卡…')).toBeInTheDocument();
    expect(screen.getByText('PPT 怎么开始')).toBeInTheDocument();
    // 只有 m2（bot 有文本）这一条 bot 气泡；m4 是空文本占位，不应该单独渲染出气泡
    expect(document.querySelectorAll('.rounded-bl-\\[5px\\]')).toHaveLength(2); // m2 气泡 + 打字指示器
  });

  it('输入并提交会调用 onSend 并清空输入框', () => {
    const onSend = vi.fn();
    renderSheet({ onSend });
    const input = screen.getByLabelText('对话输入') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '回一句' } });
    fireEvent.click(screen.getByLabelText('发送'));
    expect(onSend).toHaveBeenCalledWith('回一句', undefined);
    expect(input.value).toBe('');
  });

  it('busy 时输入框禁用', () => {
    renderSheet({ busy: true });
    expect(screen.getByLabelText('对话输入')).toBeDisabled();
  });

  describe('小派回复渲染真富文本，不是原始 markdown 符号', () => {
    it('bot 消息里的 ** 加粗 ** 渲成真的 <strong>，不是字面 **', () => {
      renderSheet({
        messages: [{ id: 'm1', role: 'bot', text: '**会议纪要任务已划掉！** 群里已经发出去了吧？' }],
      });
      const strong = screen.getByText('会议纪要任务已划掉！', { selector: 'strong' });
      expect(strong).toBeInTheDocument();
      expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    });

    it('bot 消息里的 --- 分隔线渲成真的 <hr>，不是字面 ---', () => {
      const { container } = renderSheet({
        messages: [{ id: 'm1', role: 'bot', text: '先看看这个\n\n---\n\n再看看那个' }],
      });
      expect(container.querySelector('hr')).toBeInTheDocument();
      expect(screen.queryByText(/^---$/)).not.toBeInTheDocument();
    });

    it('user 消息保持原样展示，不做 markdown 解析（用户打字不该被当成 markdown 语法）', () => {
      renderSheet({ messages: [{ id: 'm1', role: 'user', text: '这个 **重要** 吗？' }] });
      expect(screen.getByText('这个 **重要** 吗？')).toBeInTheDocument();
      expect(screen.queryByText('重要', { selector: 'strong' })).not.toBeInTheDocument();
    });
  });
});
