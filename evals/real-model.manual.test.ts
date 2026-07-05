/**
 * T24 真模型冒烟——只手动跑，不进 pnpm eval / pnpm test / CI（文件名不是 *.eval.test.ts，
 * 两份 vitest config 的 include 都不会捡到它）。需要真实 API key 才有意义：
 *
 *   PAIHUO_REAL_API_KEY=sk-xxx PAIHUO_REAL_MODEL=deepseek-reasoner \
 *     pnpm eval:real
 *
 * 没设 key 时全部用例自动跳过（不报错，方便 `pnpm eval:real` 被误跑一次不会看起来像挂了）。
 * 复用 evals/fixtures/decomposerGoldens.ts 的 rawText（同一套输入），把 mockOutput 换成
 * 真模型的真实产出——人工读 console.log 里的内容，跟 mockOutput 的人工标注比接近程度，
 * 不改契约（zod schema/工具签名），只看提示词措辞要不要微调。
 */
import { describe, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useTasksStore } from '@/src/store/tasksStore';
import { useGroupsStore } from '@/src/store/groupsStore';
import { useRelationsStore } from '@/src/store/relationsStore';
import { useUiStore } from '@/src/store/uiStore';
import { useFragmentsStore } from '@/src/store/fragmentsStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { streamChatCompletion as realStreamChatCompletion } from '@/src/llm/transport';
import { runDecompose } from '@/src/agents/runDecompose';
import { runOrganize } from '@/src/agents/runOrganize';
import { runChat } from '@/src/agents/runChat';
import { runReport } from '@/src/agents/runReport';
import { DECOMPOSER_GOLDENS } from './fixtures/decomposerGoldens';
import type { Task } from '@/src/store/schema';

const API_KEY = process.env.PAIHUO_REAL_API_KEY;
const BASE_URL = process.env.PAIHUO_REAL_BASE_URL ?? 'https://api.deepseek.com';
const MODEL = process.env.PAIHUO_REAL_MODEL ?? 'deepseek-reasoner';
const HAS_KEY = !!API_KEY;

function deps() {
  return {
    registry: createDefaultToolRegistry(),
    llm: createLlmDriver({ baseUrl: BASE_URL, apiKey: API_KEY ?? '' }, realStreamChatCompletion),
    defaultModel: MODEL,
  };
}

function logRun(label: string, agentRun: { outcome: string; error?: { kind: string; message: string } }) {
  console.log(`\n--- [${label}] outcome=${agentRun.outcome}${agentRun.error ? ` error=${agentRun.error.kind}:${agentRun.error.message}` : ''} ---`);
}

describe.skipIf(!HAS_KEY)(`真模型冒烟（model=${MODEL}，没设 PAIHUO_REAL_API_KEY 时整体跳过）`, () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useTasksStore.setState({ tasks: {} });
    useGroupsStore.setState({ groups: {} });
    useRelationsStore.setState({ relations: [] });
    useUiStore.setState({ activeTab: 'overview', reveal: null, notification: null });
    useFragmentsStore.setState({ fragments: {} });
  });

  describe.each(DECOMPOSER_GOLDENS)('拆解官 · $id — $description', (golden) => {
    it(
      '真模型产出 vs 人工标注（人工读 console 输出比较）',
      async () => {
        // 跟真实 DumpPanel 一样先经 addFragment 落库，read_attachment 才能按 fragmentId 查到——
        // 之前直接手搓 Fragment 对象不走 store，会让真模型正确猜出的 fragmentId 也查无此片段
        const fragment = useFragmentsStore.getState().addFragment({
          raw: golden.rawText,
          attachments: golden.attachmentText ? [{ name: '附件.txt', text: golden.attachmentText }] : [],
        });
        const result = await runDecompose(fragment, { ...deps(), existingTasks: [] });
        logRun(`拆解·${golden.id}`, result.agentRun);
        if (result.agentRun.outcome === 'contract_fallback' || result.agentRun.outcome === 'bailout') {
          console.log(
            '每轮原始 assistantText（诊断契约校验失败原因）:',
            JSON.stringify(result.agentRun.turns.map((t) => t.assistantText), null, 2),
          );
        }
        console.log(
          '每轮工具调用详情:',
          JSON.stringify(
            result.agentRun.turns.map((t) => t.toolCalls.map((c) => ({ name: c.name, args: c.args, result: c.result }))),
            null,
            2,
          ),
        );
        console.log('人工标注 mockOutput:', JSON.stringify(golden.mockOutput.tasks.map((t) => ({ title: t.title, type: t.type, fit: t.fit, toolId: t.toolId })), null, 2));
        if (result.ok) {
          console.log('真模型产出 tasks:', JSON.stringify(result.output.tasks.map((t) => ({ title: t.title, type: t.type, fit: t.fit, toolId: t.toolId, prompt: t.prompt?.slice(0, 60) })), null, 2));
        } else {
          console.log('真模型失败:', result.error);
        }
      },
      60_000,
    );
  });

  it(
    '整理官 · 发布会 PPT + 宣传文案应该被识别出关联',
    async () => {
      const created = useTasksStore.getState().addTasks([
        { title: '发布会 PPT：给经销商讲渠道政策', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
        { title: '发布会宣传文案，先出两版', type: 'write', fit: 'full', saveMin: 50, fragmentId: 'f1' },
      ]);
      const result = await runOrganize(Object.values(useTasksStore.getState().tasks), deps());
      logRun('整理官', result.agentRun);
      console.log('真模型产出 relations:', JSON.stringify(result.relations, null, 2));
      console.log('error(如有):', result.error);
      console.log('两个真实 task id 供人工核对:', created.map((t) => t.id));
    },
    60_000,
  );

  describe('小派 orchestrator · 三个剧本', () => {
    let meetingTaskId: string;
    let pptTaskId: string;

    beforeEach(() => {
      const created = useTasksStore.getState().addTasks([
        { title: '整理今天的会议纪要，下班前发群里', type: 'write', fit: 'full', saveMin: 40, fragmentId: 'f1' },
        { title: '发布会 PPT：给经销商讲渠道政策', type: 'slide', fit: 'assist', saveMin: 90, fragmentId: 'f1' },
      ]);
      meetingTaskId = created[0].id;
      pptTaskId = created[1].id;
    });

    it(
      '剧本① 「会议纪要发完了」——期望调 complete_task',
      async () => {
        const existingTasks = Object.values(useTasksStore.getState().tasks);
        const result = await runChat('会议纪要发完了', [], { ...deps(), existingTasks });
        logRun('剧本①', result.agentRun);
        console.log('期望 complete_task 的 id:', meetingTaskId);
        console.log('真实调用的工具:', JSON.stringify(result.agentRun.turns.flatMap((t) => t.toolCalls.map((c) => ({ name: c.name, args: c.args }))), null, 2));
        if (result.ok) console.log('终局文本:', result.text);
        else console.log('失败:', result.error);
      },
      60_000,
    );

    it(
      '剧本② 「PPT 不知道从哪下手」——期望调 reveal_card + 分步教学',
      async () => {
        const existingTasks = Object.values(useTasksStore.getState().tasks);
        const result = await runChat('PPT 不知道从哪下手', [], { ...deps(), existingTasks });
        logRun('剧本②', result.agentRun);
        console.log('期望 reveal_card 的 id:', pptTaskId);
        console.log('真实调用的工具:', JSON.stringify(result.agentRun.turns.flatMap((t) => t.toolCalls.map((c) => ({ name: c.name, args: c.args }))), null, 2));
        if (result.ok) console.log('终局文本:', result.text);
        else console.log('失败:', result.error);
      },
      60_000,
    );

    it(
      '剧本③ 胡乱输入——期望不调工具，走友好兜底',
      async () => {
        const existingTasks = Object.values(useTasksStore.getState().tasks);
        const result = await runChat('啊我也不知道该说啥随便打点字', [], { ...deps(), existingTasks });
        logRun('剧本③', result.agentRun);
        const toolCallCount = result.agentRun.turns.flatMap((t) => t.toolCalls).length;
        console.log('实际工具调用次数（期望 0）:', toolCallCount);
        if (result.ok) console.log('终局文本:', result.text);
        else console.log('失败:', result.error);
      },
      60_000,
    );
  });

  describe.each(['daily', 'weekly', 'monthly'] as const)('汇报官 · %s', (kind) => {
    it(
      '生成报告，人工读输出判断可读性',
      async () => {
        const tasks: Task[] = [
          {
            id: 't1',
            title: '整理今天的会议纪要，下班前发群里',
            type: 'write',
            fit: 'full',
            status: 'done',
            saveMin: 40,
            fragmentId: 'f1',
            createdAt: 0,
            doneAt: 1000,
          },
          {
            id: 't2',
            title: '发布会 PPT：给经销商讲渠道政策',
            type: 'slide',
            fit: 'assist',
            status: 'todo',
            saveMin: 90,
            fragmentId: 'f1',
            createdAt: 0,
          },
        ];
        useTasksStore.setState({ tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) });
        const result = await runReport(kind, { ...deps(), existingTasks: tasks });
        logRun(`汇报·${kind}`, result.agentRun);
        if (result.ok) console.log(`${kind} 报告全文:\n${result.text}`);
        else console.log('失败:', result.error);
      },
      60_000,
    );
  });
});
