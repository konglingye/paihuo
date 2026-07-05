import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';
import { useTasksStore } from '@/src/store/tasksStore';
import { useUiStore } from '@/src/store/uiStore';
import { notifyTool, openToolSiteTool, revealCardTool, uiTools } from './ui';

const task = {
  id: 't1',
  title: '发布会 PPT：给经销商讲渠道政策',
  type: 'slide' as const,
  fit: 'assist' as const,
  status: 'todo' as const,
  saveMin: 90,
  fragmentId: 'f1',
  createdAt: 0,
};

describe('ui 工具（reveal_card/notify/open_tool_site）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: { [task.id]: task } });
    useUiStore.setState({ activeTab: 'overview', reveal: null, notification: null });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('uiTools 导出恰好是三个，effect 全是 ui', () => {
    expect(uiTools.map((t) => t.name).sort()).toEqual(['notify', 'open_tool_site', 'reveal_card']);
    uiTools.forEach((t) => expect(t.effect).toBe('ui'));
  });

  describe('reveal_card', () => {
    it('切到活儿 tab 并记录目标任务 id', async () => {
      await revealCardTool.handler({ taskId: 't1' });
      expect(useUiStore.getState().activeTab).toBe('jobs');
      expect(useUiStore.getState().reveal).toMatchObject({ taskId: 't1' });
    });

    it('任务不存在时报错，不改 UI 状态', () => {
      expect(() => revealCardTool.handler({ taskId: 'ghost' })).toThrow('任务不存在');
      expect(useUiStore.getState().reveal).toBeNull();
    });
  });

  describe('notify', () => {
    it('把文本记进 uiStore.notification 供桥接组件转成 toast', async () => {
      const result = await notifyTool.handler({ text: '活儿有点多，喝口水' });
      expect(useUiStore.getState().notification).toMatchObject({ text: '活儿有点多，喝口水' });
      expect(result).toEqual({ notified: true });
    });
  });

  describe('open_tool_site', () => {
    it('目录里没有这个 id 时报错', async () => {
      await expect(openToolSiteTool.handler({ toolId: 'ghost-tool' })).rejects.toThrow('工具目录');
    });

    it('打开目录里工具的真实 URL，不传 textToCopy 就不碰剪贴板', async () => {
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
      const result = await openToolSiteTool.handler({ toolId: 'kimi' });

      expect(createSpy).toHaveBeenCalledWith({ url: expect.stringContaining('kimi.com') });
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(result).toMatchObject({ opened: true, name: 'Kimi' });
      createSpy.mockRestore();
    });

    it('传了 textToCopy 就先复制再开标签', async () => {
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
      await openToolSiteTool.handler({ toolId: 'kimi', textToCopy: '帮我出个大纲【产品卖点】' });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('帮我出个大纲【产品卖点】');
      expect(createSpy).toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });
});
