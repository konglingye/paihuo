import { describe, expect, it } from 'vitest';
import { buildDecomposerProfile, DecomposerOutputSchema } from './decomposer';
import { buildOrganizerProfile, OrganizerOutputSchema } from './organizer';
import { buildReporterProfile } from './reporter';
import { buildOrchestratorProfile } from './orchestrator';
import type { Task } from '@/src/store/schema';

const sampleTasks: Task[] = [
  {
    id: 't1',
    title: '整理今天的会议纪要，下班前发群里',
    type: 'write',
    fit: 'full',
    status: 'todo',
    saveMin: 40,
    fragmentId: 'f1',
    createdAt: 0,
    due: { text: '今天 18:00', hot: true },
  },
];

describe('decomposer profile', () => {
  const profile = buildDecomposerProfile(sampleTasks);

  it('组装出的 systemPrompt 快照锁定', () => {
    expect(profile.systemPrompt).toMatchSnapshot();
  });

  it('工具白名单只包含已落地的只读工具', () => {
    expect(profile.toolNames).toEqual(['search_tool_catalog', 'read_attachment']);
  });

  it('outputContract 接受符合 spec §6.1 形状的样例', () => {
    const sample = {
      tasks: [
        { localId: 'n1', title: '整理会议纪要', type: 'write', fit: 'full', saveMin: 40 },
      ],
      groups: [],
      relates: [],
    };
    expect(DecomposerOutputSchema.safeParse(sample).success).toBe(true);
  });

  it('fallback 把原文塞进一张待手动拆的卡', () => {
    const result = profile.fallback?.('这段话解析不出来');
    expect(result).toMatchObject({ tasks: [{ fit: 'self', type: 'misc' }] });
  });
});

describe('organizer profile', () => {
  const profile = buildOrganizerProfile(sampleTasks);

  it('组装出的 systemPrompt 快照锁定', () => {
    expect(profile.systemPrompt).toMatchSnapshot();
  });

  it('工具白名单只有只读工具（自动 run 不许碰 ui/external/写工具）', () => {
    expect(profile.toolNames).toEqual(['list_tasks', 'get_task']);
  });

  it('outputContract 接受空建议数组', () => {
    expect(OrganizerOutputSchema.safeParse({ suggestions: [] }).success).toBe(true);
  });
});

describe('reporter profile', () => {
  const profile = buildReporterProfile(sampleTasks);

  it('组装出的 systemPrompt 快照锁定', () => {
    expect(profile.systemPrompt).toMatchSnapshot();
  });

  it('没有 outputContract（终局是 markdown 报告文本）', () => {
    expect(profile.outputContract).toBeUndefined();
  });

  it('低温快档', () => {
    expect(profile.params?.temperature).toBe(0.3);
  });
});

describe('orchestrator profile', () => {
  const profile = buildOrchestratorProfile(sampleTasks);

  it('组装出的 systemPrompt 快照锁定', () => {
    expect(profile.systemPrompt).toMatchSnapshot();
  });

  it('没有 outputContract（终局是对话文本）', () => {
    expect(profile.outputContract).toBeUndefined();
  });

  it('工具白名单包含当前已落地的任务库+内容工具', () => {
    expect(profile.toolNames).toEqual([
      'list_tasks',
      'get_task',
      'update_task',
      'complete_task',
      'create_tasks',
      'read_attachment',
      'draft_user_prompt',
      'draft_message',
    ]);
  });
});
