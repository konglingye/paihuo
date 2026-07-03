import { buildStateSnapshotBlock } from '../../harness/context';
import type { Task } from '@/src/store/schema';

// 这块存在的原因：让模型知道当前任务板长什么样，但只给压缩视图（一行一条），
// 细节靠 get_task 主动拉取——检索优先于灌注，不然完整 JSON 会把上下文撑爆
export function buildStateBlock(tasks: Task[]): string {
  return `# 当前任务板\n${buildStateSnapshotBlock(tasks)}`;
}
