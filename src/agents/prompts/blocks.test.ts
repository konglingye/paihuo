import { describe, expect, it } from 'vitest';
import { buildIdentityBlock } from './blocks/identity';
import { buildToolPolicyBlock } from './blocks/toolPolicy';
import { buildStateBlock } from './blocks/state';
import { buildContractBlock } from './blocks/contract';
import { buildStyleBlock } from './blocks/style';
import { buildMemoryBlock } from './blocks/memory';
import { assembleSystemPrompt } from './assemble';
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
  {
    id: 't2',
    title: '周报（上周复盘 + 本周计划）',
    type: 'write',
    fit: 'assist',
    status: 'done',
    saveMin: 30,
    fragmentId: 'f1',
    createdAt: 0,
  },
];

describe('提示词六块模板（快照锁定，改动需过 review diff）', () => {
  it('identity block', () => {
    expect(buildIdentityBlock({ name: '拆解官', persona: '你负责把领导甩过来的活儿拆解成可交付的任务卡。' })).toMatchSnapshot();
  });

  it('toolPolicy block 有内容', () => {
    expect(buildToolPolicyBlock(['toolId 必须来自 search_tool_catalog 的结果，选不出就留空'])).toMatchSnapshot();
  });

  it('toolPolicy block 为空数组时返回空字符串', () => {
    expect(buildToolPolicyBlock([])).toBe('');
  });

  it('state block', () => {
    expect(buildStateBlock(sampleTasks)).toMatchSnapshot();
  });

  it('state block 空任务板', () => {
    expect(buildStateBlock([])).toMatchSnapshot();
  });

  it('state block 带 extra 时追加在任务板后面（供汇报官塞工作日志/用户信息用）', () => {
    const result = buildStateBlock(sampleTasks, '# 用户信息\n称呼：李哥');
    expect(result).toContain('# 当前任务板');
    expect(result).toContain('# 用户信息\n称呼：李哥');
  });

  it('state block 不传 extra 时行为和以前一样', () => {
    expect(buildStateBlock(sampleTasks, undefined)).toBe(buildStateBlock(sampleTasks));
  });

  it('contract block 有描述', () => {
    expect(buildContractBlock('{tasks: [...], groups: [...], relates: [...]}')).toMatchSnapshot();
  });

  it('contract block 没有契约时返回空字符串', () => {
    expect(buildContractBlock(undefined)).toBe('');
  });

  it('style block', () => {
    expect(buildStyleBlock(['说人话、短句、先给结论', '适度幽默，绝不说教'])).toMatchSnapshot();
  });

  it('memory block 没有记忆内容时返回空字符串（T15 前）', () => {
    expect(buildMemoryBlock(undefined)).toBe('');
  });
});

describe('assembleSystemPrompt', () => {
  it('六块按顺序拼接，快照锁定', () => {
    const result = assembleSystemPrompt({
      identity: buildIdentityBlock({ name: '拆解官', persona: '你负责拆解任务。' }),
      toolPolicy: buildToolPolicyBlock(['只能用封闭目录里的工具']),
      state: buildStateBlock(sampleTasks),
      contract: buildContractBlock('{tasks: [...]}'),
      style: buildStyleBlock(['宁保守不吹牛']),
      memory: buildMemoryBlock(undefined),
    });
    expect(result).toMatchSnapshot();
  });

  it('空块会被跳过，不留多余空行堆叠', () => {
    const result = assembleSystemPrompt({
      identity: buildIdentityBlock({ name: '小派', persona: '你是同事。' }),
      toolPolicy: '',
      state: '',
      contract: '',
      style: '',
      memory: '',
    });
    expect(result).toBe('# 身份\n你是「小派」。你是同事。');
  });
});
