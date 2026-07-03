// 这块存在的原因：带 outputContract 的 profile 必须清楚知道终局要交出什么形状的 JSON，
// 且不能夹杂解释文字/代码块——不然 zod 校验会失败，退回契约修复重试
export function buildContractBlock(description?: string): string {
  if (!description) return '';
  return `# 输出契约\n最终答案只能是一段纯 JSON，不要加任何解释文字，也不要用 markdown 代码块包裹。\n${description}`;
}
