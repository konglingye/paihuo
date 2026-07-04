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
});
