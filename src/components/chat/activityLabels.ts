/**
 * 活动指示短句（arch §6 产品级要求）：工具调用发生时，UI 要能看见小派在干嘛。
 * 这里的文案是给用户看的口语短句，跟工具的 description（面向模型的技术说明）是两回事。
 */
const ACTIVITY_LABELS: Record<string, string> = {
  list_tasks: '正在翻手里的活儿…',
  get_task: '正在看这件事的细节…',
  update_task: '正在改任务…',
  complete_task: '正在帮你划掉…',
  create_tasks: '正在建任务卡…',
  group_tasks: '正在把活儿归到一组…',
  link_tasks: '正在记下这几件事的关联…',
  search_tool_catalog: '正在翻工具库…',
  read_attachment: '正在读你贴的内容…',
  get_prompt_template: '正在配提示词模板…',
  draft_user_prompt: '正在写提示词…',
  draft_message: '正在写句话…',
  reveal_card: '正在带你去看那张卡…',
  notify: '正在提醒你…',
  open_tool_site: '正在开工具网站…',
  dispatch: '正在把这活儿转给同事…',
};

/** 只取这一批里第一个调用来定活动短句——同一批通常是同类型操作，没必要逐个列 */
export function describeActivity(calls: { name: string }[]): string {
  const first = calls[0];
  if (!first) return '正在想…';
  return ACTIVITY_LABELS[first.name] ?? '正在处理…';
}
