import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useSettingsStore, useTasksStore, useUiStore } from '@/src/store';
import { OverviewPanel } from './OverviewPanel';
import type { Task } from '@/src/store/schema';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '整理今天的会议纪要',
    type: 'write',
    fit: 'full',
    status: 'todo',
    saveMin: 40,
    fragmentId: 'f1',
    createdAt: 0,
    ...overrides,
  };
}

describe('OverviewPanel（spec §3.1）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useUiStore.setState({ activeTab: 'overview', taskFilter: 'all', reveal: null });
    useSettingsStore.getState().resetSettings();
  });

  describe('还没倒过活儿（空态）', () => {
    it('显示引导条、进度环 0/0、类型看板和截止列表都是空态文案', () => {
      render(<OverviewPanel />);
      expect(screen.getByText(/活儿还没倒进来/)).toBeInTheDocument();
      expect(screen.getByText('0/0')).toBeInTheDocument();
      expect(screen.getByText('拆出活儿后，这里按类型分好类')).toBeInTheDocument();
      expect(screen.getByText('没有压着的截止时间，舒坦。')).toBeInTheDocument();
      expect(screen.getByText('还没划掉活儿。干完一件回来看看，这里会替你记着。')).toBeInTheDocument();
    });

    it('点引导条切到活儿 tab', () => {
      render(<OverviewPanel />);
      fireEvent.click(screen.getByText(/活儿还没倒进来/));
      expect(useUiStore.getState().activeTab).toBe('jobs');
    });
  });

  describe('有活儿时', () => {
    beforeEach(() => {
      useTasksStore.setState({
        tasks: {
          t1: makeTask({ id: 't1', title: '整理会议纪要', type: 'write', status: 'done', saveMin: 40 }),
          t2: makeTask({
            id: 't2',
            title: '发布会 PPT',
            type: 'slide',
            status: 'todo',
            saveMin: 90,
            due: { text: '今天 18:00', hot: true },
          }),
          t3: makeTask({
            id: 't3',
            title: '汇总销售数据',
            type: 'data',
            status: 'todo',
            saveMin: 30,
            due: { text: '下周三', hot: false },
          }),
        },
      });
    });

    it('不显示引导条', () => {
      render(<OverviewPanel />);
      expect(screen.queryByText(/活儿还没倒进来/)).not.toBeInTheDocument();
    });

    it('进度环显示 done/total，统计行显示总数/完成数/省时', () => {
      render(<OverviewPanel />);
      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.getByText(/今天 3 件/)).toBeInTheDocument();
      expect(screen.getByText(/完成 1/)).toBeInTheDocument();
      expect(screen.getByText('≈2 小时')).toBeInTheDocument(); // 90+30=120 分钟 → 换算成 2 小时
    });

    it('按类型看展示各类型 chip 及计数', () => {
      render(<OverviewPanel />);
      expect(screen.getByRole('button', { name: /写作.*1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /演示.*1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /数据.*1/ })).toBeInTheDocument();
    });

    it('点类型 chip 切筛选并跳到活儿 tab', () => {
      render(<OverviewPanel />);
      fireEvent.click(screen.getByRole('button', { name: /演示/ }));
      expect(useUiStore.getState().taskFilter).toBe('slide');
      expect(useUiStore.getState().activeTab).toBe('jobs');
    });

    it('盯紧截止时间：hot 的排前面，点击跳去活儿 tab 并高亮对应卡片', () => {
      render(<OverviewPanel />);
      const rows = screen.getAllByRole('button', { name: /今天 18:00|下周三/ });
      expect(rows[0]).toHaveTextContent('发布会 PPT'); // hot 排前面

      fireEvent.click(screen.getByText('发布会 PPT'));
      expect(useUiStore.getState().activeTab).toBe('jobs');
      expect(useUiStore.getState().reveal).toMatchObject({ taskId: 't2' });
    });

    it('已完成的任务不出现在截止列表里', () => {
      render(<OverviewPanel />);
      expect(screen.queryByText('整理会议纪要')).not.toBeInTheDocument();
    });

    it('今天的成果展示已完成数量与省时', () => {
      render(<OverviewPanel />);
      expect(screen.getByText(/已划掉/).closest('p')).toHaveTextContent('已划掉 1 件 · AI 帮你省了约 40 分钟');
    });

    it('点"把今天写成日报"切到汇报 tab', () => {
      render(<OverviewPanel />);
      fireEvent.click(screen.getByRole('button', { name: /把今天写成日报/ }));
      expect(useUiStore.getState().activeTab).toBe('report');
    });
  });
});
