import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

describe('MarkdownView', () => {
  it('把标题/加粗渲染成真实元素，不是原样吐出 # 和 ** 符号', () => {
    render(<MarkdownView text={'# 日报\n\n**完成 1 件**'} />);
    expect(screen.getByRole('heading', { level: 1, name: '日报' })).toBeInTheDocument();
    expect(screen.getByText('完成 1 件').tagName).toBe('STRONG');
    expect(screen.queryByText('# 日报')).not.toBeInTheDocument();
  });

  it('渲染 GFM 表格（汇报官常用 | 列 | 列 | 格式）', () => {
    const md = '| 事项 | 状态 |\n|------|------|\n| 会议纪要 | 完成 |';
    render(<MarkdownView text={md} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('会议纪要')).toBeInTheDocument();
    expect(screen.getByText('完成')).toBeInTheDocument();
  });

  it('流式生成中间态（还没闭合的 markdown 片段）不应该抛错', () => {
    expect(() => render(<MarkdownView text={'# 日报\n\n## 今日完成\n\n| 事'} />)).not.toThrow();
  });
});
