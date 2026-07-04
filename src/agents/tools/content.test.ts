import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import {
  draftMessageTool,
  draftUserPromptTool,
  getPromptTemplateTool,
  readAttachmentTool,
} from './content';

describe('read_attachment', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useFragmentsStore.setState({ fragments: {} });
  });

  it('片段不存在时抛错', () => {
    expect(() => readAttachmentTool.handler({ fragmentId: 'not-exist' })).toThrow();
  });

  it('短文本一块就能读完，hasMore=false', async () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: '一段不长的原话' });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result).toEqual({ chunk: 0, totalChunks: 1, hasMore: false, text: '一段不长的原话' });
  });

  it('不传 chunk 时默认返回第 0 块', async () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: 'x'.repeat(5000) });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result.chunk).toBe(0);
  });

  it('长文档按块翻页，chunk 拼起来等于原文，最后一块 hasMore=false', async () => {
    const raw = Array.from({ length: 5000 }, (_, i) => String(i % 10)).join('');
    const fragment = useFragmentsStore.getState().addFragment({ raw });

    const first = await readAttachmentTool.handler({ fragmentId: fragment.id, chunk: 0 });
    expect(first.hasMore).toBe(true);
    expect(first.totalChunks).toBeGreaterThan(1);

    let combined = '';
    for (let i = 0; i < first.totalChunks; i++) {
      const part = await readAttachmentTool.handler({ fragmentId: fragment.id, chunk: i });
      combined += part.text;
      expect(part.hasMore).toBe(i < first.totalChunks - 1);
    }
    expect(combined).toBe(raw);
  });

  it('chunk 超出范围时抛错（错误路径）', () => {
    const fragment = useFragmentsStore.getState().addFragment({ raw: '短文本' });
    expect(() => readAttachmentTool.handler({ fragmentId: fragment.id, chunk: 99 })).toThrow();
  });

  it('附件文本也会拼进可读取的全文', async () => {
    const fragment = useFragmentsStore.getState().addFragment({
      raw: '正文部分',
      attachments: [{ name: 'a.txt', text: '附件里的内容' }],
    });
    const result = await readAttachmentTool.handler({ fragmentId: fragment.id });
    expect(result.text).toContain('正文部分');
    expect(result.text).toContain('附件里的内容');
  });

  it('schema 拒绝负数 chunk', () => {
    const parsed = readAttachmentTool.paramsSchema.safeParse({ fragmentId: 'f1', chunk: -1 });
    expect(parsed.success).toBe(false);
  });
});

describe('get_prompt_template', () => {
  it('按 taskType 返回四段骨架，含【】空槽', async () => {
    const result = await getPromptTemplateTool.handler({ taskType: 'slide' });
    expect(result.role).toBeTruthy();
    expect(result.task).toContain('【');
    expect(result.format).toBeTruthy();
    expect(result.tone).toBeTruthy();
  });

  it('传已知 toolId 时把工具名带进角色段', async () => {
    const result = await getPromptTemplateTool.handler({ taskType: 'slide', toolId: 'aippt' });
    expect(result.role).toContain('AiPPT');
  });

  it('toolId 不在目录内时优雅降级为通用骨架，不报错', async () => {
    const result = await getPromptTemplateTool.handler({ taskType: 'write', toolId: 'not-in-catalog' });
    expect(result.role).toBeTruthy();
  });

  it('5 个任务类型都有骨架', () => {
    (['write', 'slide', 'data', 'comm', 'misc'] as const).forEach((taskType) => {
      expect(() => getPromptTemplateTool.handler({ taskType })).not.toThrow();
    });
  });
});

describe('draft_user_prompt', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
  });

  it('给已存在的任务生成外部提示词', async () => {
    const [task] = useTasksStore.getState().addTasks([
      { title: '发布会 PPT', type: 'slide', fit: 'assist', toolId: 'aippt', saveMin: 90, fragmentId: 'f1' },
    ]);
    const result = await draftUserPromptTool.handler({ taskId: task.id });
    expect(result.prompt).toContain('AiPPT');
    expect(result.prompt).toContain('【');
  });

  it('传入 slots 覆盖对应段落，未覆盖的段落保留默认空槽', async () => {
    const [task] = useTasksStore.getState().addTasks([
      { title: '写通知', type: 'comm', fit: 'full', saveMin: 10, fragmentId: 'f1' },
    ]);
    const result = await draftUserPromptTool.handler({
      taskId: task.id,
      slots: { task: '通知大家周五全员大会，下午 3 点，一号会议室' },
    });
    expect(result.prompt).toContain('周五全员大会');
    expect(result.prompt).toContain('语气：得体');
  });

  it('任务不存在时抛错', () => {
    expect(() => draftUserPromptTool.handler({ taskId: 'not-exist' })).toThrow();
  });
});

describe('draft_message', () => {
  it('nudge：催办小抄', async () => {
    const result = await draftMessageTool.handler({
      kind: 'nudge',
      context: { taskTitle: '合同审核', recipient: '李哥' },
    });
    expect(result.message).toContain('李哥');
    expect(result.message).toContain('合同审核');
  });

  it('howto：3 步教学', async () => {
    const result = await draftMessageTool.handler({ kind: 'howto', context: { taskTitle: 'PPT 大纲' } });
    expect(result.message).toContain('1.');
    expect(result.message).toContain('2.');
    expect(result.message).toContain('3.');
  });

  it('direct：可直接发送的话术', async () => {
    const result = await draftMessageTool.handler({ kind: 'direct', context: { detail: '合同我已经发过去了' } });
    expect(result.message).toBe('合同我已经发过去了');
  });
});
