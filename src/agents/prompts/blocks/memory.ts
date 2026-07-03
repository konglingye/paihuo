// 这块存在的原因：给长期记忆（用户画像/纠正记录）留一个固定挂载点；
// T15 长期记忆落地前内容为空，assemble 时会被自动跳过
export function buildMemoryBlock(memoryText?: string): string {
  if (!memoryText) return '';
  return `# 记忆\n${memoryText}`;
}
