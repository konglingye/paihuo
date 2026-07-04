import type { ChatMessage } from '@/src/llm/types';
import type { Fragment, Task } from '@/src/store/schema';
import { estimateMessagesTokens, estimateTokens } from './budget';

/** 会话历史窗口预算（默认 8k）——和 T06 单次 run 的 32k 上限是两回事，这个管的是持续对话的滚动历史 */
export const DEFAULT_HISTORY_TOKEN_BUDGET = 8000;
/** 压缩时至少保留的最近消息数（对应 arch "保留最近 6 轮原文"） */
export const KEEP_RECENT_MESSAGES = 6;

const EXCERPT_CHARS = 1000;

/**
 * 状态快照块：任务板压缩视图，每任务一行，永不注入完整 JSON。
 * 细节交给模型自己用 get_task 拉取——检索优先于灌注（arch §3.1）。
 */
export function buildStateSnapshotBlock(tasks: Task[]): string {
  if (tasks.length === 0) return '（暂无任务）';
  return tasks
    .map((task) => {
      const due = task.due ? ` due=${task.due.text}${task.due.hot ? '!' : ''}` : '';
      return `- ${task.id} [${task.status}] ${task.title} fit=${task.fit}${due}`;
    })
    .join('\n');
}

/**
 * Fragment 只注入首 1k 字摘录 + 元信息，长文档/附件全文由模型用 read_attachment 分块翻页（arch §3.1）。
 * read_attachment 的 fragmentId 参数认的是这个 fragment 自己的 id（附件文本本来就是跟原文一起
 * 存在同一个 fragment 里的，见 content.ts 的 fullTextOf），必须把这个 id 明说给模型——
 * T24 真模型冒烟实测：只提附件文件名不给 id，模型会拿文件名当 fragmentId 硬传，
 * 六轮全部「片段不存在」，最后 bailout 交不出任何结果。
 */
export function excerptFragment(fragment: Fragment): string {
  const truncated = fragment.raw.length > EXCERPT_CHARS;
  const excerpt = fragment.raw.slice(0, EXCERPT_CHARS);
  const hasAttachments = fragment.attachments.length > 0;
  const attachmentNote = hasAttachments
    ? `\n附件：${fragment.attachments.map((a) => a.name).join('、')}`
    : '';
  let readNote = '';
  if (truncated && hasAttachments) {
    readNote = `\n…（原文已截断；原文全文和附件内容都用 read_attachment(fragmentId="${fragment.id}") 从 chunk=0 开始分块读取）`;
  } else if (truncated) {
    readNote = `\n…（已截断，完整内容用 read_attachment(fragmentId="${fragment.id}") 分块读取）`;
  } else if (hasAttachments) {
    readNote = `\n（附件内容用 read_attachment(fragmentId="${fragment.id}") 分块读取，从 chunk=0 开始）`;
  }
  return `${excerpt}${attachmentNote}${readNote}`;
}

/**
 * token 估算 + 响应 usage 校准（arch §3.2）：各家模型没有统一 tokenizer，
 * chars/1.6 只是启发式，用真实 usage 反过来校准比例，让后续估算更准。
 */
export class CalibratedEstimator {
  private ratio = 1;

  estimate(text: string): number {
    return Math.ceil(estimateTokens(text) * this.ratio);
  }

  calibrate(estimatedTokens: number, actualTokens: number): void {
    if (estimatedTokens <= 0) return;
    const observed = actualTokens / estimatedTokens;
    // 指数滑动平均，避免单次异常 usage 把估算比例带偏
    this.ratio = this.ratio * 0.7 + observed * 0.3;
  }

  getRatio(): number {
    return this.ratio;
  }
}

export function needsCompression(messages: ChatMessage[], budget: number = DEFAULT_HISTORY_TOKEN_BUDGET): boolean {
  return estimateMessagesTokens(messages) > budget;
}

export interface CompressHistoryResult {
  messages: ChatMessage[];
  compressed: boolean;
  summary?: string;
}

/**
 * 会话历史超预算 → 压缩：最老的一部分交给模型生成滚动摘要（含未决事项），
 * 替换原文；保留最近 N 轮原文不动。压缩本身记入 trace 是调用方的事（这里只做机制）。
 */
export async function compressHistory(
  messages: ChatMessage[],
  summarize: (oldMessages: ChatMessage[]) => Promise<string>,
  keepRecent: number = KEEP_RECENT_MESSAGES,
): Promise<CompressHistoryResult> {
  if (messages.length <= keepRecent) {
    return { messages, compressed: false };
  }

  const recentCount = Math.max(Math.ceil(messages.length / 2), keepRecent);
  const splitIndex = Math.max(0, messages.length - recentCount);
  if (splitIndex === 0) {
    return { messages, compressed: false };
  }

  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);
  const summary = await summarize(oldMessages);

  return {
    messages: [{ role: 'system', content: `历史摘要（含未决事项）：${summary}` }, ...recentMessages],
    compressed: true,
    summary,
  };
}
