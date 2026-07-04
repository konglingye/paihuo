import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TypeFilterRow } from './TypeFilterRow';
import type { Task } from '@/src/store/schema';

function makeTask(id: string, type: Task['type']): Task {
  return { id, title: id, type, fit: 'self', status: 'todo', saveMin: 0, fragmentId: 'f1', createdAt: 0 };
}

const tasks = [makeTask('t1', 'write'), makeTask('t2', 'write'), makeTask('t3', 'slide')];

describe('TypeFilterRow', () => {
  it('渲染全部 + 出现过的类型 chips，带计数；没出现的类型不渲染', () => {
    render(<TypeFilterRow tasks={tasks} value="all" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '全部3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '写作2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '演示1' })).toBeInTheDocument();
    expect(screen.queryByText('数据')).not.toBeInTheDocument();
  });

  it('点击类型 chip 会带对应值调用 onChange', () => {
    const onChange = vi.fn();
    render(<TypeFilterRow tasks={tasks} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '演示1' }));
    expect(onChange).toHaveBeenCalledWith('slide');
  });
});
