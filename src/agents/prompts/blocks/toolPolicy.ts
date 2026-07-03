// 这块存在的原因：工具的 name/description/parameters 已经通过 tools 请求字段直接喂给模型了，
// 这里不重复罗列工具清单，只讲工具使用的边界和原则（例如"目录是封闭的，不许编造"）
export function buildToolPolicyBlock(policies: string[]): string {
  if (policies.length === 0) return '';
  return `# 工具使用原则\n${policies.map((p) => `- ${p}`).join('\n')}`;
}
