import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupHeader } from './GroupHeader';

describe('GroupHeader', () => {
  it('渲染标签文本', () => {
    render(<GroupHeader kind="urgent" label="今天必须交" />);
    expect(screen.getByText('今天必须交')).toBeInTheDocument();
  });

  it('project 类型且有 relatedCount 时显示"N 件有关联"', () => {
    render(<GroupHeader kind="project" label="下周一 · 新品发布会" relatedCount={2} />);
    expect(screen.getByText('2 件有关联')).toBeInTheDocument();
  });

  it('daily 类型不显示关联数', () => {
    render(<GroupHeader kind="daily" label="日常" />);
    expect(screen.queryByText(/件有关联/)).not.toBeInTheDocument();
  });
});
