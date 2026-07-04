import { describe, expect, it } from 'vitest';
import { mockStreamChatCompletion } from './mockTransport';
import { DECOMPOSER_SAMPLE_INPUT, DEFAULT_FIXTURE } from './fixtures';
import { DecomposerOutputSchema } from '@/src/agents/profiles/decomposer';

describe('mockStreamChatCompletion', () => {
  it('没有 fixture 命中时用 DEFAULT_FIXTURE，逐片调用 onDelta 并拼出完整内容', async () => {
    const deltas: string[] = [];
    const result = await mockStreamChatCompletion(
      { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: '随便说点什么' }] },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas).toEqual(DEFAULT_FIXTURE.chunks);
    expect(result.content).toBe(DEFAULT_FIXTURE.chunks!.join(''));
    expect(result.usage).toEqual(DEFAULT_FIXTURE.usage);
  });

  it('按最后一条用户消息匹配到对应 fixture（多轮剧本第 1 步是工具调用，不产文本）', async () => {
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [
          { role: 'system', content: '# 当前任务板\n- t1 [todo] 整理今天的会议纪要，下班前发群里 fit=full' },
          { role: 'assistant', content: '在' },
          { role: 'user', content: '会议纪要发完了' },
        ],
      },
      {},
    );

    expect(result.content).toBe('');
    expect(result.toolCalls).toEqual([{ id: 'mock-tool-0-0', name: 'complete_task', arguments: JSON.stringify({ id: 't1' }) }]);
  });

  it('多轮剧本第 2 步（tool 结果已回来）给出文本结论，不再调工具', async () => {
    const deltas: string[] = [];
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [
          { role: 'system', content: '# 当前任务板\n- t1 [todo] 整理今天的会议纪要，下班前发群里 fit=full' },
          { role: 'user', content: '会议纪要发完了' },
          { role: 'assistant', content: '', toolCalls: [{ id: 'mock-tool-0-0', name: 'complete_task', arguments: '{"id":"t1"}' }] },
          { role: 'tool', toolCallId: 'mock-tool-0-0', content: '{"ok":true}' },
        ],
      },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(result.toolCalls).toBeUndefined();
    expect(result.content).toContain('划掉了');
    expect(deltas.join('')).toBe(result.content);
  });

  it('外部 signal 已 abort 时立即抛出 aborted 错误', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      mockStreamChatCompletion(
        { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: 'hi' }] },
        {},
        controller.signal,
      ),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('流式中途 abort 会停止后续分片投递', async () => {
    const controller = new AbortController();
    const deltas: string[] = [];
    const promise = mockStreamChatCompletion(
      { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [{ role: 'user', content: '随便说点什么' }] },
      {
        onDelta: (d) => {
          deltas.push(d);
          if (deltas.length === 1) controller.abort();
        },
      },
      controller.signal,
    );

    await expect(promise).rejects.toMatchObject({ kind: 'aborted' });
    expect(deltas.length).toBeLessThan(DEFAULT_FIXTURE.chunks!.length);
  });

  it('拆解官发布会剧本 fixture 拼出的内容符合 DecomposerOutputSchema', async () => {
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [{ role: 'user', content: DECOMPOSER_SAMPLE_INPUT }],
      },
      {},
    );

    const parsed = DecomposerOutputSchema.safeParse(JSON.parse(result.content));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tasks).toHaveLength(4);
      expect(parsed.data.relates[0].aIds).toEqual(['n2', 'n3']);
    }
  });

  it('整理官 fixture（respond 动态生成）能从状态快照里抠出真实 task id', async () => {
    const stateSnapshot = [
      '- t-ppt-real-id [todo] 发布会 PPT：给经销商讲渠道政策 fit=assist',
      '- t-copy-real-id [todo] 发布会宣传文案，先出两版 fit=full',
    ].join('\n');
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [{ role: 'user', content: `找找现有任务里有没有能合并推进的。\n${stateSnapshot}` }],
      },
      {},
    );

    const parsed = JSON.parse(result.content);
    expect(parsed.suggestions).toHaveLength(1);
    expect(parsed.suggestions[0].taskIds).toEqual(['t-ppt-real-id', 't-copy-real-id']);
  });

  it('整理官 fixture 找不到对应任务时返回空建议，不瞎编', async () => {
    const result = await mockStreamChatCompletion(
      {
        baseUrl: 'mock://',
        apiKey: '',
        model: 'mock',
        messages: [{ role: 'user', content: '找找现有任务里有没有能合并推进的。\n（暂无任务）' }],
      },
      {},
    );
    expect(JSON.parse(result.content)).toEqual({ suggestions: [] });
  });

  describe('汇报官 fixture（spec §6.4：query_task_history + 可选 read_template）', () => {
    const noTemplateSystem = { role: 'system' as const, content: '# 模板\n没有上传模板，按默认结构写' };
    const withTemplateSystem = {
      role: 'system' as const,
      content: '# 模板\n已上传模板「周报模板.docx」——写之前先调 read_template 读取全文，严格套用它的层级结构和措辞口径',
    };

    it('没有模板：第 1 步调 query_task_history(range=today)', async () => {
      const result = await mockStreamChatCompletion(
        {
          baseUrl: 'mock://',
          apiKey: '',
          model: 'mock',
          messages: [noTemplateSystem, { role: 'user', content: '写一份日报。' }],
        },
        {},
      );
      expect(result.toolCalls).toEqual([
        { id: 'mock-tool-0-0', name: 'query_task_history', arguments: JSON.stringify({ range: 'today' }) },
      ]);
    });

    it('没有模板：第 2 步（工具结果已回来）直接给默认结构文本，不再调工具', async () => {
      const result = await mockStreamChatCompletion(
        {
          baseUrl: 'mock://',
          apiKey: '',
          model: 'mock',
          messages: [
            noTemplateSystem,
            { role: 'user', content: '写一份日报。' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'query_task_history', arguments: '{}' }] },
            { role: 'tool', toolCallId: 'c1', content: '{}' },
          ],
        },
        {},
      );
      expect(result.toolCalls).toBeUndefined();
      expect(result.content).toContain('【今日完成】');
    });

    it('有模板：第 2 步改成调 read_template，不直接给文本', async () => {
      const result = await mockStreamChatCompletion(
        {
          baseUrl: 'mock://',
          apiKey: '',
          model: 'mock',
          messages: [
            withTemplateSystem,
            { role: 'user', content: '写一份日报。' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'query_task_history', arguments: '{}' }] },
            { role: 'tool', toolCallId: 'c1', content: '{}' },
          ],
        },
        {},
      );
      expect(result.content).toBe('');
      expect(result.toolCalls).toEqual([{ id: 'mock-tool-1-0', name: 'read_template', arguments: '{}' }]);
    });

    it('有模板：第 3 步（read_template 结果也回来了）给出模板结构的文本，跟默认结构明显不同', async () => {
      const result = await mockStreamChatCompletion(
        {
          baseUrl: 'mock://',
          apiKey: '',
          model: 'mock',
          messages: [
            withTemplateSystem,
            { role: 'user', content: '写一份日报。' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'query_task_history', arguments: '{}' }] },
            { role: 'tool', toolCallId: 'c1', content: '{}' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c2', name: 'read_template', arguments: '{}' }] },
            { role: 'tool', toolCallId: 'c2', content: '{}' },
          ],
        },
        {},
      );
      expect(result.toolCalls).toBeUndefined();
      expect(result.content).toContain('按公司模板格式输出');
      expect(result.content).not.toContain('【今日完成】');
    });

    it('周报/月报也各自匹配到正确的 range', async () => {
      const weekly = await mockStreamChatCompletion(
        { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [noTemplateSystem, { role: 'user', content: '写一份周报。' }] },
        {},
      );
      expect(weekly.toolCalls?.[0].arguments).toBe(JSON.stringify({ range: 'week' }));

      const monthly = await mockStreamChatCompletion(
        { baseUrl: 'mock://', apiKey: '', model: 'mock', messages: [noTemplateSystem, { role: 'user', content: '写一份月报。' }] },
        {},
      );
      expect(monthly.toolCalls?.[0].arguments).toBe(JSON.stringify({ range: 'month' }));
    });
  });
});
