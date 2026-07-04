import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelationBanner } from './RelationBanner';
import type { Relation } from '@/src/store/schema';

const relation: Relation = {
  id: 'r1',
  taskIds: ['t1', 't2'],
  reason: '发布会 PPT 和宣传文案用的是同一套信息',
  suggestion: '先花 5 分钟定下：新品卖点、政策要点、时间地点',
  createdAt: 0,
};

describe('RelationBanner', () => {
  it('展示原因和建议', () => {
    render(<RelationBanner relation={relation} onGoToChat={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('发现关联')).toBeInTheDocument();
    expect(screen.getByText(/发布会 PPT 和宣传文案用的是同一套信息/)).toBeInTheDocument();
    expect(screen.getByText(/先花 5 分钟定下/)).toBeInTheDocument();
  });

  it('点击"好，先定关键信息"触发 onGoToChat', () => {
    const onGoToChat = vi.fn();
    render(<RelationBanner relation={relation} onGoToChat={onGoToChat} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '好，先定关键信息' }));
    expect(onGoToChat).toHaveBeenCalledOnce();
  });

  it('点击"分开做"触发 onDismiss', () => {
    const onDismiss = vi.fn();
    render(<RelationBanner relation={relation} onGoToChat={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '分开做' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
