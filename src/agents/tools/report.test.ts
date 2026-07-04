import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useReportTemplateStore } from '@/src/store/reportTemplateStore';
import { queryTaskHistoryTool, readTemplateTool, reportTools } from './report';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('report 工具（query_task_history/read_template，spec §6.4）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useReportTemplateStore.setState({ template: null });
  });

  it('reportTools 导出恰好是两个，都是 read', () => {
    expect(reportTools.map((t) => t.name).sort()).toEqual(['query_task_history', 'read_template']);
    reportTools.forEach((t) => expect(t.effect).toBe('read'));
  });

  describe('query_task_history', () => {
    it('range=today 只算今天完成的，进行中的任务不受时间范围限制', () => {
      const now = Date.now();
      useTasksStore.setState({
        tasks: {
          doneToday: {
            id: 'doneToday',
            title: '今天做完的',
            type: 'write',
            fit: 'full',
            status: 'done',
            saveMin: 30,
            fragmentId: 'f1',
            createdAt: now,
            doneAt: now,
          },
          doneLastWeek: {
            id: 'doneLastWeek',
            title: '上周做完的',
            type: 'write',
            fit: 'full',
            status: 'done',
            saveMin: 20,
            fragmentId: 'f1',
            createdAt: now - 8 * DAY_MS,
            doneAt: now - 8 * DAY_MS,
          },
          openOld: {
            id: 'openOld',
            title: '很久之前建的还没做完',
            type: 'data',
            fit: 'assist',
            status: 'todo',
            saveMin: 40,
            fragmentId: 'f1',
            createdAt: now - 60 * DAY_MS,
          },
        },
      });

      const result = queryTaskHistoryTool.handler({ range: 'today' }) as {
        completed: { id: string }[];
        inProgress: { id: string }[];
        totalSavedMin: number;
      };

      expect(result.completed.map((t) => t.id)).toEqual(['doneToday']);
      expect(result.inProgress.map((t) => t.id)).toEqual(['openOld']);
      expect(result.totalSavedMin).toBe(30);
    });

    it('range=week 把最近 7 天完成的都算进去', () => {
      const now = Date.now();
      useTasksStore.setState({
        tasks: {
          t1: {
            id: 't1',
            title: '3 天前完成',
            type: 'write',
            fit: 'full',
            status: 'done',
            saveMin: 10,
            fragmentId: 'f1',
            createdAt: now,
            doneAt: now - 3 * DAY_MS,
          },
        },
      });

      const result = queryTaskHistoryTool.handler({ range: 'week' }) as { completed: { id: string }[] };
      expect(result.completed.map((t) => t.id)).toEqual(['t1']);
    });
  });

  describe('read_template', () => {
    it('没有上传模板时报错', () => {
      expect(() => readTemplateTool.handler({})).toThrow('没有上传');
    });

    it('上传了模板时返回名字和全文', () => {
      useReportTemplateStore.getState().setTemplate({ name: 'x.docx', text: '# 周报模板' });
      expect(readTemplateTool.handler({})).toEqual({ name: 'x.docx', text: '# 周报模板' });
    });
  });
});
