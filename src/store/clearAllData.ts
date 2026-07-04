import { useSettingsStore } from './settingsStore';
import { useTasksStore } from './tasksStore';
import { useFragmentsStore } from './fragmentsStore';
import { useGroupsStore } from './groupsStore';
import { useReportsStore } from './reportsStore';
import { useRelationsStore } from './relationsStore';
import { useTraceStore } from './traceStore';
import { useMemoryStore } from './memoryStore';
import { useWorklogStore } from './worklogStore';
import { useReportTemplateStore } from './reportTemplateStore';

/** 设置页「清空所有数据」（双确认）：key 和任务只存本机浏览器，一键全部清空 */
export function clearAllData(): void {
  useSettingsStore.getState().resetSettings();
  useTasksStore.setState({ tasks: {} });
  useFragmentsStore.setState({ fragments: {} });
  useGroupsStore.setState({ groups: {} });
  useReportsStore.setState({ reports: [] });
  useRelationsStore.setState({ relations: [] });
  useTraceStore.getState().clearRuns();
  useMemoryStore.setState({ facts: [] });
  useWorklogStore.setState({ entries: [], lastActiveDate: null, eodNudgeDate: null });
  useReportTemplateStore.getState().clearTemplate();
}
