import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { buildDailySummary, useWorklogStore } from './worklogStore';
import type { Task } from './schema';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '整理会议纪要',
    type: 'write',
    fit: 'full',
    status: 'done',
    saveMin: 40,
    fragmentId: 'f1',
    createdAt: 0,
    doneAt: new Date('2026-07-04T10:00:00').getTime(),
    ...overrides,
  };
}

describe('buildDailySummary（纯函数：从任务算出某天的摘要）', () => {
  it('当天没有完成任何任务时给出空闲文案', () => {
    expect(buildDailySummary([], '2026-07-04')).toBe('今天没有标记完成的活儿');
  });

  it('汇总当天完成的任务数量与省时总和', () => {
    const tasks = [
      makeTask({ id: 't1', title: '整理会议纪要', saveMin: 40 }),
      makeTask({ id: 't2', title: '发布会宣传文案', saveMin: 50 }),
    ];
    const summary = buildDailySummary(tasks, '2026-07-04');
    expect(summary).toContain('完成 2 件活儿');
    expect(summary).toContain('90 分钟');
    expect(summary).toContain('整理会议纪要');
    expect(summary).toContain('发布会宣传文案');
  });

  it('只统计目标日期完成的任务，不含其他天', () => {
    const tasks = [
      makeTask({ id: 't1', doneAt: new Date('2026-07-03T23:00:00').getTime() }),
      makeTask({ id: 't2', doneAt: new Date('2026-07-04T09:00:00').getTime() }),
    ];
    expect(buildDailySummary(tasks, '2026-07-04')).toContain('完成 1 件活儿');
  });

  it('未完成（无 doneAt）的任务不计入', () => {
    const tasks = [makeTask({ status: 'todo', doneAt: undefined })];
    expect(buildDailySummary(tasks, '2026-07-04')).toBe('今天没有标记完成的活儿');
  });
});

describe('worklogStore（工作日志，spec §3.3）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useWorklogStore.setState({ entries: [], lastActiveDate: null, eodNudgeDate: null });
  });

  it('初始为空', () => {
    expect(useWorklogStore.getState().entries).toEqual([]);
    expect(useWorklogStore.getState().lastActiveDate).toBeNull();
    expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
  });

  it('recordDay 写入或覆盖指定日期的摘要（同一天调用两次不会重复）', () => {
    const tasks = [makeTask()];
    useWorklogStore.getState().recordDay('2026-07-04', tasks);
    useWorklogStore.getState().recordDay('2026-07-04', tasks);
    expect(useWorklogStore.getState().entries).toHaveLength(1);
    expect(useWorklogStore.getState().entries[0]).toMatchObject({ date: '2026-07-04' });
  });

  it('archiveIfNewDay 首次调用只记录 lastActiveDate，不产生摘要（没有"上一次"可归档）', () => {
    useWorklogStore.getState().archiveIfNewDay('2026-07-04', []);
    expect(useWorklogStore.getState().lastActiveDate).toBe('2026-07-04');
    expect(useWorklogStore.getState().entries).toEqual([]);
  });

  it('archiveIfNewDay 换了新的一天：把上一个 lastActiveDate 的摘要写进工作日志', () => {
    const tasks = [makeTask({ doneAt: new Date('2026-07-04T18:00:00').getTime() })];
    useWorklogStore.getState().archiveIfNewDay('2026-07-04', tasks);
    useWorklogStore.getState().archiveIfNewDay('2026-07-05', tasks);

    expect(useWorklogStore.getState().lastActiveDate).toBe('2026-07-05');
    expect(useWorklogStore.getState().entries).toHaveLength(1);
    expect(useWorklogStore.getState().entries[0].date).toBe('2026-07-04');
    expect(useWorklogStore.getState().entries[0].summary).toContain('完成 1 件活儿');
  });

  it('同一天内多次调用 archiveIfNewDay 不会重复归档', () => {
    useWorklogStore.getState().archiveIfNewDay('2026-07-04', []);
    useWorklogStore.getState().archiveIfNewDay('2026-07-04', []);
    expect(useWorklogStore.getState().entries).toEqual([]);
  });

  it('滚动保留 90 天：超过 90 天的旧条目会被裁掉', () => {
    useWorklogStore.setState({
      entries: [
        { date: '2026-01-01', summary: '很久以前的摘要' },
        { date: '2026-06-01', summary: '一个月前的摘要' },
      ],
      lastActiveDate: '2026-07-04',
    });
    useWorklogStore.getState().archiveIfNewDay('2026-07-05', []);

    const dates = useWorklogStore.getState().entries.map((e) => e.date);
    expect(dates).not.toContain('2026-01-01');
    expect(dates).toContain('2026-06-01');
  });

  it('roundtrip：能从已有的 chrome.storage.local 数据水合出状态', async () => {
    await fakeBrowser.storage.local.set({
      'paihuo:worklog': JSON.stringify({
        state: { entries: [{ date: '2026-07-01', summary: '历史摘要' }], lastActiveDate: '2026-07-01' },
        version: 1,
      }),
    });

    await useWorklogStore.persist.rehydrate();

    expect(useWorklogStore.getState().entries).toMatchObject([{ date: '2026-07-01' }]);
    expect(useWorklogStore.getState().lastActiveDate).toBe('2026-07-01');
  });

  describe('checkEodAlarm（arch §5 alarm.eod：今天有完成任务且没写日报才提醒）', () => {
    it('今天有完成任务且没写日报：记下待展示的提醒', () => {
      const tasks = [makeTask({ doneAt: new Date('2026-07-04T10:00:00').getTime() })];
      useWorklogStore.getState().checkEodAlarm('2026-07-04', tasks, false);
      expect(useWorklogStore.getState().eodNudgeDate).toBe('2026-07-04');
    });

    it('已经写过日报：不提醒', () => {
      const tasks = [makeTask({ doneAt: new Date('2026-07-04T10:00:00').getTime() })];
      useWorklogStore.getState().checkEodAlarm('2026-07-04', tasks, true);
      expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
    });

    it('今天没有完成任何任务：不提醒', () => {
      useWorklogStore.getState().checkEodAlarm('2026-07-04', [], false);
      expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
    });

    it('dismissEodNudge 清空提醒', () => {
      const tasks = [makeTask({ doneAt: new Date('2026-07-04T10:00:00').getTime() })];
      useWorklogStore.getState().checkEodAlarm('2026-07-04', tasks, false);
      useWorklogStore.getState().dismissEodNudge();
      expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
    });
  });
});
