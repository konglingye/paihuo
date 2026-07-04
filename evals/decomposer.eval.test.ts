import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { runDecompose } from '@/src/agents/runDecompose';
import { findCatalogEntry } from '@/src/agents/tools/catalog';
import { DECOMPOSER_GOLDENS } from './fixtures/decomposerGoldens';
import type { LlmDriver } from '@/src/agents/harness/llmDriver';
import type { Fragment } from '@/src/store/schema';

const SLOT_PATTERN = /【[^】]*】/;

function scriptedLlmFor(mockOutput: unknown): LlmDriver {
  return async () => ({ text: JSON.stringify(mockOutput), toolCalls: [] });
}

describe('拆解 evals（arch §7）：≥6 段金标准原话，mock 通道验证结构性规则始终成立', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useGroupsStore.setState({ groups: {} });
    useRelationsStore.setState({ relations: [] });
  });

  it('金标准场景至少有 6 个（arch §7 要求）', () => {
    expect(DECOMPOSER_GOLDENS.length).toBeGreaterThanOrEqual(6);
  });

  describe.each(DECOMPOSER_GOLDENS)('$id — $description', (golden) => {
    it('走完整 runDecompose 链路，契约校验通过且任务数在预期区间内', async () => {
      const fragment: Fragment = {
        id: `eval-${golden.id}`,
        raw: golden.rawText,
        attachments: golden.attachmentText ? [{ name: '附件.txt', text: golden.attachmentText }] : [],
        createdAt: 0,
      };

      const result = await runDecompose(fragment, {
        registry: createDefaultToolRegistry(),
        llm: scriptedLlmFor(golden.mockOutput),
        defaultModel: 'mock',
        existingTasks: [],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const taskCount = result.materialized.tasks.length;
      const [min, max] = golden.expectedTaskCountRange;
      expect(taskCount).toBeGreaterThanOrEqual(min);
      expect(taskCount).toBeLessThanOrEqual(max);
    });

    it('每条非 self 任务的提示词至少含一个【】空槽（用户只填空）', async () => {
      const fragment: Fragment = {
        id: `eval-${golden.id}-slots`,
        raw: golden.rawText,
        attachments: golden.attachmentText ? [{ name: '附件.txt', text: golden.attachmentText }] : [],
        createdAt: 0,
      };
      const result = await runDecompose(fragment, {
        registry: createDefaultToolRegistry(),
        llm: scriptedLlmFor(golden.mockOutput),
        defaultModel: 'mock',
        existingTasks: [],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      result.materialized.tasks
        .filter((t) => t.fit !== 'self' && t.prompt)
        .forEach((t) => {
          expect(t.prompt, `任务「${t.title}」的提示词应该有【】空槽`).toMatch(SLOT_PATTERN);
        });
    });

    it('toolId（如果有）必须来自封闭工具目录，不能是编造的', async () => {
      const fragment: Fragment = {
        id: `eval-${golden.id}-toolid`,
        raw: golden.rawText,
        attachments: golden.attachmentText ? [{ name: '附件.txt', text: golden.attachmentText }] : [],
        createdAt: 0,
      };
      const result = await runDecompose(fragment, {
        registry: createDefaultToolRegistry(),
        llm: scriptedLlmFor(golden.mockOutput),
        defaultModel: 'mock',
        existingTasks: [],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      result.materialized.tasks
        .filter((t) => t.toolId)
        .forEach((t) => {
          expect(findCatalogEntry(t.toolId!), `toolId "${t.toolId}" 不在目录内`).toBeDefined();
        });
    });

    it('due（如果有）必须带非空展示文本', async () => {
      const fragment: Fragment = {
        id: `eval-${golden.id}-due`,
        raw: golden.rawText,
        attachments: golden.attachmentText ? [{ name: '附件.txt', text: golden.attachmentText }] : [],
        createdAt: 0,
      };
      const result = await runDecompose(fragment, {
        registry: createDefaultToolRegistry(),
        llm: scriptedLlmFor(golden.mockOutput),
        defaultModel: 'mock',
        existingTasks: [],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      result.materialized.tasks
        .filter((t) => t.due)
        .forEach((t) => {
          expect(t.due!.text.trim().length).toBeGreaterThan(0);
        });
    });
  });

  it('fit 保守性（跨全部金标准场景）：既要出现 assist/full 混合，且"需要业务判断"的场景不能标 full', async () => {
    const strategyGolden = DECOMPOSER_GOLDENS.find((g) => g.id === 'fit-conservative-strategy')!;
    const strategyTask = strategyGolden.mockOutput.tasks.find((t) => t.title.includes('定价策略'));
    expect(strategyTask?.fit).toBe('assist'); // 需要人来拍板，不能标成 AI 可完全代劳

    const allFits = DECOMPOSER_GOLDENS.flatMap((g) => g.mockOutput.tasks.map((t) => t.fit));
    expect(allFits).toContain('full');
    expect(allFits).toContain('assist');
  });
});
