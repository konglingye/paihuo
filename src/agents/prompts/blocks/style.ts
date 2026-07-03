// 这块存在的原因：统一语气人设，避免不同 profile 的回复风格互相打架（如拆解官突然开始讲笑话）
export function buildStyleBlock(notes: string[]): string {
  if (notes.length === 0) return '';
  return `# 语气与风格\n${notes.map((n) => `- ${n}`).join('\n')}`;
}
