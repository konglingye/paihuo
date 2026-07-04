import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { useReportsStore } from '@/src/store/reportsStore';
import { useUiStore } from '@/src/store/uiStore';
import { useWorklogStore } from '@/src/store/worklogStore';
import { createDefaultToolRegistry } from './registry';
import { EventBus } from './events';
import { registerDefaultEventRules } from './eventRules';
import type { LlmDriver, LlmDriverResult } from './harness/llmDriver';

function scriptedLlm(script: LlmDriverResult[]): LlmDriver {
  let i = 0;
  return async () => script[Math.min(i++, script.length - 1)];
}

describe('registerDefaultEventRules（arch §5 规则表）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useRelationsStore.setState({ relations: [] });
    useReportsStore.setState({ reports: [] });
    useUiStore.setState({ notification: null });
    useWorklogStore.setState({ entries: [], lastActiveDate: null, eodNudgeDate: null });
  });

  describe('dump.created → 自动跑一次整理官找关联', () => {
    it('有 ≥2 件未完成任务时，命中的关联会落进 relationsStore（不需要手动点找关联）', async () => {
      const created = useTasksStore.getState().addTasks([
        { title: '发布会 PPT：给经销商讲渠道政策', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
        { title: '发布会宣传文案，先出两版', type: 'write', fit: 'full', saveMin: 50, fragmentId: 'f1' },
      ]);
      const [taskA, taskB] = created;

      const llm = scriptedLlm([
        {
          text: JSON.stringify({
            suggestions: [{ taskIds: [taskA.id, taskB.id], reason: '同一套信息', suggestion: '先定关键信息' }],
          }),
          toolCalls: [],
        },
      ]);
      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({ registry: createDefaultToolRegistry(), llm, defaultModel: 'mock' }));

      await bus.emit({ type: 'dump.created', fragmentId: 'f1' });

      expect(useRelationsStore.getState().relations).toHaveLength(1);
      expect(useRelationsStore.getState().relations[0].taskIds.sort()).toEqual([taskA.id, taskB.id].sort());
    });

    it('未完成任务不足 2 件时不调用 LLM，也不产生关联', async () => {
      useTasksStore.getState().addTasks([{ title: '只有一件', type: 'misc', fit: 'self', saveMin: 0, fragmentId: 'f1' }]);
      let called = false;
      const llm: LlmDriver = async () => {
        called = true;
        return { text: '{"suggestions":[]}', toolCalls: [] };
      };
      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({ registry: createDefaultToolRegistry(), llm, defaultModel: 'mock' }));

      await bus.emit({ type: 'dump.created', fragmentId: 'f1' });

      expect(called).toBe(false);
      expect(useRelationsStore.getState().relations).toEqual([]);
    });
  });

  describe('task.completed → 轻量检查（不调 LLM）：命中已知关联里还没做完的任务就建议下一件', () => {
    it('有关联且对方未完成时，弹出"建议下一件"提醒', async () => {
      const [taskA, taskB] = useTasksStore.getState().addTasks([
        { title: '发布会 PPT', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
        { title: '发布会宣传文案', type: 'write', fit: 'full', saveMin: 50, fragmentId: 'f1' },
      ]);
      useRelationsStore.getState().addRelation({ taskIds: [taskA.id, taskB.id], reason: '同一套信息' });
      useTasksStore.getState().completeTask(taskA.id);

      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'task.completed', taskId: taskA.id });

      expect(useUiStore.getState().notification?.text).toContain('发布会宣传文案');
    });

    it('关联的另一件也已完成时不重复建议', async () => {
      const [taskA, taskB] = useTasksStore.getState().addTasks([
        { title: '发布会 PPT', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
        { title: '发布会宣传文案', type: 'write', fit: 'full', saveMin: 50, fragmentId: 'f1' },
      ]);
      useRelationsStore.getState().addRelation({ taskIds: [taskA.id, taskB.id], reason: '同一套信息' });
      useTasksStore.getState().completeTask(taskA.id);
      useTasksStore.getState().completeTask(taskB.id);

      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'task.completed', taskId: taskB.id });

      expect(useUiStore.getState().notification).toBeNull();
    });

    it('没有任何已知关联时不弹提醒', async () => {
      const [taskA] = useTasksStore.getState().addTasks([
        { title: '孤立任务', type: 'misc', fit: 'self', saveMin: 0, fragmentId: 'f1' },
      ]);
      useTasksStore.getState().completeTask(taskA.id);

      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'task.completed', taskId: taskA.id });

      expect(useUiStore.getState().notification).toBeNull();
    });
  });

  describe('alarm.eod → 检查今天有没有完成任务且没写日报', () => {
    it('今天有完成任务且没写日报：worklogStore 记下待展示的提醒', async () => {
      const [taskA] = useTasksStore.getState().addTasks([
        { title: '今天干的活', type: 'misc', fit: 'self', saveMin: 20, fragmentId: 'f1' },
      ]);
      useTasksStore.getState().completeTask(taskA.id);

      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'alarm.eod' });

      expect(useWorklogStore.getState().eodNudgeDate).not.toBeNull();
    });

    it('今天已经写过日报：不提醒', async () => {
      const [taskA] = useTasksStore.getState().addTasks([
        { title: '今天干的活', type: 'misc', fit: 'self', saveMin: 20, fragmentId: 'f1' },
      ]);
      useTasksStore.getState().completeTask(taskA.id);
      useReportsStore.getState().addReport({ kind: 'daily', content: '今日已写' });

      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'alarm.eod' });

      expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
    });

    it('今天没有完成任何任务：不提醒', async () => {
      const bus = new EventBus();
      registerDefaultEventRules(bus, () => ({
        registry: createDefaultToolRegistry(),
        llm: scriptedLlm([{ text: '', toolCalls: [] }]),
        defaultModel: 'mock',
      }));

      await bus.emit({ type: 'alarm.eod' });

      expect(useWorklogStore.getState().eodNudgeDate).toBeNull();
    });
  });
});
