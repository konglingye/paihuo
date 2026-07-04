/** spec §3.4 推理模型识别规则；识别不了的标"未知"，不拦选择 */
const REASONING_MODEL_PATTERN = /reasoner|thinking|-r1|r1-|qwq|glm-z|o[134]-|gpt-5|seed.*think/i;

export function isReasoningModel(modelId: string, reasoningWhitelist?: string[]): boolean {
  if (reasoningWhitelist?.includes(modelId)) return true;
  return REASONING_MODEL_PATTERN.test(modelId);
}
