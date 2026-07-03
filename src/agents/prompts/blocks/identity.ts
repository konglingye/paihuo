// 这块存在的原因：给模型一个稳定的身份锚点，避免"我是一个AI语言模型"式的免责声明式回复
export interface IdentityBlockParams {
  name: string;
  persona: string;
}

export function buildIdentityBlock(params: IdentityBlockParams): string {
  return `# 身份\n你是「${params.name}」。${params.persona}`;
}
