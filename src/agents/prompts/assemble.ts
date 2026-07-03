export interface AssembleSystemPromptInput {
  identity: string;
  toolPolicy: string;
  state: string;
  contract: string;
  style: string;
  memory: string;
}

/** 按 identity/tool-policy/state/contract/style/memory 顺序拼系统提示词，空块自动跳过（arch §4） */
export function assembleSystemPrompt(input: AssembleSystemPromptInput): string {
  return [input.identity, input.toolPolicy, input.state, input.contract, input.style, input.memory]
    .filter((block) => block.trim().length > 0)
    .join('\n\n');
}
