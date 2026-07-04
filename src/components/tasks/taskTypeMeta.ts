import type { TaskType } from '@/src/store/schema';

/** 五个任务类型的中文标签 + 展示顺序，任务列表/筛选行/总览页按类型看都用这一份 */
export const TYPE_LABELS: Record<TaskType, string> = {
  write: '写作',
  slide: '演示',
  data: '数据',
  comm: '沟通',
  misc: '杂事',
};

export const TYPE_ORDER: TaskType[] = ['write', 'slide', 'data', 'comm', 'misc'];
