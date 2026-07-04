import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { clearAllData } from './clearAllData';
import { DEFAULT_SETTINGS, useSettingsStore } from './settingsStore';
import { useTasksStore } from './tasksStore';
import { useFragmentsStore } from './fragmentsStore';
import { useGroupsStore } from './groupsStore';
import { useReportsStore } from './reportsStore';
import { useRelationsStore } from './relationsStore';
import { useTraceStore } from './traceStore';
import { useMemoryStore } from './memoryStore';
import { useWorklogStore } from './worklogStore';
import { useReportTemplateStore } from './reportTemplateStore';

describe('clearAllData（设置页"清空所有数据"）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useSettingsStore.getState().setSettings({ apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com' });
    useTasksStore.getState().addTasks([{ title: 'x', type: 'misc', fit: 'self', saveMin: 0, fragmentId: 'f1' }]);
    useFragmentsStore.getState().addFragment({ raw: 'x' });
    useGroupsStore.getState().addGroup({ label: 'x', kind: 'daily' });
    useReportsStore.getState().addReport({ kind: 'daily', content: 'x' });
    useTraceStore.getState().addRun({
      id: 'r1',
      profileName: 'decomposer',
      inputSummary: 'x',
      turns: [],
      outcome: 'text',
      finalText: 'x',
      startedAt: 0,
      finishedAt: 1,
    });
    useMemoryStore.getState().remember('他姓李');
    useWorklogStore.getState().archiveIfNewDay('2026-07-04', []);
    useReportTemplateStore.getState().setTemplate({ name: 'x.docx', text: 'y' });
  });

  it('清空后每个 store 都回到初始空状态', () => {
    clearAllData();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useTasksStore.getState().tasks).toEqual({});
    expect(useFragmentsStore.getState().fragments).toEqual({});
    expect(useGroupsStore.getState().groups).toEqual({});
    expect(useReportsStore.getState().reports).toEqual([]);
    expect(useRelationsStore.getState().relations).toEqual([]);
    expect(useTraceStore.getState().runs).toEqual([]);
    expect(useMemoryStore.getState().facts).toEqual([]);
    expect(useWorklogStore.getState().entries).toEqual([]);
    expect(useWorklogStore.getState().lastActiveDate).toBeNull();
    expect(useReportTemplateStore.getState().template).toBeNull();
  });
});
