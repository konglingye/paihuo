import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { buildDecomposerProfile, DecomposerOutputSchema } from './decomposer';
import { buildOrganizerProfile, OrganizerOutputSchema } from './organizer';
import { buildReporterProfile } from './reporter';
import { buildOrchestratorProfile } from './orchestrator';
import { useMemoryStore } from '@/src/store/memoryStore';
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

  it('工具白名单是 query_task_history + read_template（spec §6.4 输入清单）', () => {
    expect(profile.toolNames).toEqual(['query_task_history', 'read_template']);
  });

  it('没传 context 时，state 块里带"没有上传模板"的默认提示', () => {
    expect(profile.systemPrompt).toContain('没有上传模板，按默认结构写');
  });

  it('传了 templateName 时，state 块提示改成"已上传模板"并指示先调 read_template', () => {
    const withTemplate = buildReporterProfile(sampleTasks, { templateName: '公司周报模板.docx' });
    expect(withTemplate.systemPrompt).toContain('已上传模板「公司周报模板.docx」');
    expect(withTemplate.systemPrompt).toContain('先调 read_template 读取全文');
  });

  it('传了 worklogEntries/userName/org 时都会出现在 state 块里', () => {
    const withContext = buildReporterProfile(sampleTasks, {
      userName: '李哥',
      org: '渠道部',
      worklogEntries: [{ date: '2026-07-03', summary: '完成 2 件活儿，预计省时 60 分钟：写周报、催合同' }],
    });
    expect(withContext.systemPrompt).toContain('称呼：李哥');
    expect(withContext.systemPrompt).toContain('部门：渠道部');
    expect(withContext.systemPrompt).toContain('2026-07-03：完成 2 件活儿');
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

  it('工具白名单包含当前已落地的任务库+内容工具+ui工具+调度', () => {
    expect(profile.toolNames).toEqual([
      'list_tasks',
      'get_task',
      'update_task',
      'complete_task',
      'create_tasks',
      'read_attachment',
      'draft_user_prompt',
      'draft_message',
      'reveal_card',
      'notify',
      'open_tool_site',
      'dispatch',
      'remember',
      'recall',
    ]);
  });
});

describe('记忆块注入（T15 DoD：记忆写入→下次 run 的 system 记忆块可见）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useMemoryStore.setState({ facts: [] });
  });

  it('remember 一条事实后，四个 profile 组装出的 systemPrompt 都能看到它', () => {
    useMemoryStore.getState().remember('他说过纪要要发飞书不发微信');

    const prompts = [
      buildDecomposerProfile(sampleTasks).systemPrompt,
      buildOrganizerProfile(sampleTasks).systemPrompt,
      buildReporterProfile(sampleTasks).systemPrompt,
      buildOrchestratorProfile(sampleTasks).systemPrompt,
    ];

    prompts.forEach((prompt) => {
      expect(prompt).toContain('# 记忆');
      expect(prompt).toContain('他说过纪要要发飞书不发微信');
    });
  });

  it('没有任何记忆时，记忆块不出现在 systemPrompt 里（assemble 自动跳过空块）', () => {
    expect(buildOrchestratorProfile(sampleTasks).systemPrompt).not.toContain('# 记忆');
  });
});
