import { buildStateSnapshotBlock } from '../../harness/context';
import type { Task } from '@/src/store/schema';

// 这块存在的原因：让模型知道当前任务板长什么样，但只给压缩视图（一行一条），
// 细节靠 get_task 主动拉取——检索优先于灌注，不然完整 JSON 会把上下文撑爆。
// extra 是给汇报官这类需要额外上下文（工作日志摘要/用户称呼部门/模板提示）的 profile 用的可选追加段。
export function buildStateBlock(tasks: Task[], extra?: string): string {
  const board = `# 当前任务板\n${buildStateSnapshotBlock(tasks)}`;
  return extra ? `${board}\n\n${extra}` : board;
}
