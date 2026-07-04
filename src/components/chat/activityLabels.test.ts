import { describe, expect, it } from 'vitest';
import { describeActivity } from './activityLabels';

describe('describeActivity', () => {
  it('已知工具名映射成口语短句', () => {
    expect(describeActivity([{ name: 'reveal_card' }])).toBe('正在带你去看那张卡…');
    expect(describeActivity([{ name: 'search_tool_catalog' }])).toBe('正在翻工具库…');
  });

  it('未知工具名兜底成"正在处理…"', () => {
    expect(describeActivity([{ name: 'some_future_tool' }])).toBe('正在处理…');
  });

  it('空数组兜底成"正在想…"', () => {
    expect(describeActivity([])).toBe('正在想…');
  });

  it('一批里只看第一个调用', () => {
    expect(describeActivity([{ name: 'reveal_card' }, { name: 'notify' }])).toBe('正在带你去看那张卡…');
  });
});
