import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('渲染总览/活儿/汇报三个 tab，默认选中总览', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: '总览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '活儿' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: '汇报' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('总览面板占位')).toBeInTheDocument();
  });

  it('点击「活儿」tab 切到活儿面板', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: '活儿' }));
    expect(screen.getByRole('tab', { name: '活儿' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('活儿面板占位')).toBeInTheDocument();
  });
});
