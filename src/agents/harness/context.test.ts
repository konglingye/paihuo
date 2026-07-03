import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import type { ChatMessage } from '@/src/llm/types';
import {
  CalibratedEstimator,
  DEFAULT_HISTORY_TOKEN_BUDGET,
  KEEP_RECENT_MESSAGES,
  buildStateSnapshotBlock,
  compressHistory,
  excerptFragment,
  needsCompression,
} from './context';

describe('buildStateSnapshotBlock（状态快照块）', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
  });

  it('没有任务时给出明确的空态文案', () => {
    expect(buildStateSnapshotBlock([])).toBe('（暂无任务）');
  });

  it('每个任务一行，包含 id/标题/状态/fit/due，不包含完整 JSON', () => {
    const [task] = useTasksStore.getState().addTasks([
      { title: '整理会议纪要', type: 'write', fit: 'full', saveMin: 40, fragmentId: 'f1', due: { text: '今天 18:00', hot: true } },
    ]);
    const block = buildStateSnapshotBlock(Object.values(useTasksStore.getState().tasks));
    expect(block).toContain(task.id);
    expect(block).toContain('整理会议纪要');
    expect(block).toContain('todo');
    expect(block).toContain('fit=full');
    expect(block).toContain('今天 18:00');
    expect(block).not.toContain('fragmentId'); // 不该把内部字段/完整 JSON 灌进去
  });

  it('快照块随 store 变化（加任务/完成任务都要体现）', () => {
    const before = buildStateSnapshotBlock(Object.values(useTasksStore.getState().tasks));
    const [task] = useTasksStore.getState().addTasks([
      { title: '写周报', type: 'write', fit: 'assist', saveMin: 30, fragmentId: 'f1' },
    ]);
    const afterCreate = buildStateSnapshotBlock(Object.values(useTasksStore.getState().tasks));
    expect(afterCreate).not.toBe(before);
    expect(afterCreate).toContain('写周报');

    useTasksStore.getState().completeTask(task.id);
    const afterDone = buildStateSnapshotBlock(Object.values(useTasksStore.getState().tasks));
    expect(afterDone).toContain('done');
    expect(afterDone).not.toContain('[todo]');
  });
});

describe('excerptFragment（附件摘录）', () => {
  it('短文本原样返回，附上附件名', () => {
    const excerpt = excerptFragment({
      id: 'f1',
      raw: '领导甩了个活儿过来',
      attachments: [{ name: '转写.txt' }],
      createdAt: 0,
    });
    expect(excerpt).toContain('领导甩了个活儿过来');
    expect(excerpt).toContain('转写.txt');
  });

  it('超过 1000 字只注入首 1000 字摘录，并提示用 read_attachment 分块读取', () => {
    const longText = '啊'.repeat(1500);
    const excerpt = excerptFragment({ id: 'f1', raw: longText, attachments: [], createdAt: 0 });
    expect(excerpt).toContain('read_attachment');
    expect(excerpt.length).toBeLessThan(1200);
  });
});

describe('CalibratedEstimator（token 估算 + usage 校准）', () => {
  it('未校准时按 chars/1.6 启发式估算', () => {
    const estimator = new CalibratedEstimator();
    expect(estimator.estimate('一二三四')).toBe(Math.ceil(4 / 1.6));
  });

  it('用真实 usage 校准后，估算值会往真实值靠拢', () => {
    const estimator = new CalibratedEstimator();
    const before = estimator.estimate('一二三四五六七八');
    estimator.calibrate(before, before * 2); // 真实 token 数是估算的两倍
    const after = estimator.estimate('一二三四五六七八');
    expect(after).toBeGreaterThan(before);
  });
});

describe('needsCompression / compressHistory（历史窗口+滚动摘要压缩）', () => {
  const filler = '讨论方案细节，涉及排期与分工。'.repeat(80);

  it('消息数没超过保留轮数时不压缩', async () => {
    const messages: ChatMessage[] = [{ role: 'user', content: '你好' }];
    expect(needsCompression(messages)).toBe(false);
    const result = await compressHistory(messages, async () => '摘要');
    expect(result.compressed).toBe(false);
    expect(result.messages).toBe(messages);
  });

  it('超预算时触发压缩，摘要里的未决事项被保留，最近几轮原文不变', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: `还没约上跟客户开会的时间。${filler}` },
      { role: 'assistant', content: filler },
      ...Array.from({ length: 12 }, (_, i): ChatMessage => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `第${i}轮闲聊。${filler}`,
      })),
    ];
    expect(needsCompression(messages, DEFAULT_HISTORY_TOKEN_BUDGET)).toBe(true);

    const summarize = async (old: ChatMessage[]) => {
      const mentionsPending = old.some((m) => m.content.includes('还没约上跟客户开会的时间'));
      return mentionsPending ? '未决事项：还没约上跟客户开会的时间' : '（没有未决事项）';
    };

    const result = await compressHistory(messages, summarize);

    expect(result.compressed).toBe(true);
    expect(result.summary).toContain('还没约上跟客户开会的时间');
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toContain('未决事项');
    // 最近若干轮原文必须原样保留，不能被摘要吞掉
    const lastOriginal = messages[messages.length - 1];
    expect(result.messages[result.messages.length - 1]).toEqual(lastOriginal);
    expect(result.messages.length).toBeGreaterThanOrEqual(KEEP_RECENT_MESSAGES);
    // 压缩后应该不再超预算
    expect(needsCompression(result.messages, DEFAULT_HISTORY_TOKEN_BUDGET)).toBe(false);
  });

  it('压缩时只把最老的一部分喂给 summarize，不包含最近保留的原文', async () => {
    const messages: ChatMessage[] = Array.from({ length: 14 }, (_, i): ChatMessage => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `第${i}轮。${filler}`,
    }));
    let capturedOld: ChatMessage[] = [];
    await compressHistory(messages, async (old) => {
      capturedOld = old;
      return '摘要';
    });
    const recentTexts = messages.slice(-KEEP_RECENT_MESSAGES).map((m) => m.content);
    expect(capturedOld.some((m) => recentTexts.includes(m.content))).toBe(false);
  });
});
