import { useCallback, useRef, useState } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useTasksStore } from '@/src/store/tasksStore';
import { useTraceStore } from '@/src/store/traceStore';
import { createDefaultToolRegistry } from '@/src/agents/registry';
import { createLlmDriver } from '@/src/agents/harness/llmDriver';
import { runChat } from '@/src/agents/runChat';
import { describeActivity } from './activityLabels';
import type { ChatMessage } from '@/src/llm/types';

export interface ChatMessageVM {
  id: string;
  role: 'user' | 'bot';
  text: string;
  attachmentName?: string;
}

export interface ChatAttachment {
  name: string;
  text?: string;
}

export interface UseOrchestratorChatResult {
  messages: ChatMessageVM[];
  busy: boolean;
  /** 活动指示短句（arch §6）：工具调用期间实时更新，空转/收尾时清空 */
  activity: string | null;
  send: (text: string, attachment?: ChatAttachment) => Promise<void>;
}

const ATTACHMENT_EXCERPT_CHARS = 1000;

/** 附件内容摘录拼进真正发给模型的 input（跟 excerptFragment 的截断策略一致），聊天气泡里只显示文件名 */
function buildInput(text: string, attachment?: ChatAttachment): string {
  if (!attachment?.text) return text;
  const excerpt = attachment.text.slice(0, ATTACHMENT_EXCERPT_CHARS);
  return `${text}\n\n附件「${attachment.name}」内容：\n${excerpt}`;
}

/** 小派主对话钩子：多轮续接、流式增量拼进气泡、工具调用驱动活动指示短句，run 落进 trace */
export function useOrchestratorChat(): UseOrchestratorChatResult {
  const [messages, setMessages] = useState<ChatMessageVM[]>([]);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const settings = useSettingsStore((s) => s.settings);

  const send = useCallback(
    async (text: string, attachment?: ChatAttachment) => {
      if (busy) return;
      if (!text.trim() && !attachment) return;

      const userMessageId = crypto.randomUUID();
      const botMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: 'user', text, attachmentName: attachment?.name },
        { id: botMessageId, role: 'bot', text: '' },
      ]);
      setBusy(true);
      setActivity(null);

      const input = buildInput(text, attachment);
      const llm = createLlmDriver({ baseUrl: settings.baseUrl, apiKey: settings.apiKey });
      const registry = createDefaultToolRegistry({ llm, defaultModel: settings.model });
      const existingTasks = Object.values(useTasksStore.getState().tasks);

      const result = await runChat(
        input,
        historyRef.current,
        { registry, llm, defaultModel: settings.model, existingTasks },
        {
          onDelta: (delta) =>
            setMessages((prev) => prev.map((m) => (m.id === botMessageId ? { ...m, text: m.text + delta } : m))),
          onToolCall: (calls) => setActivity(describeActivity(calls)),
        },
      );

      useTraceStore.getState().addRun(result.agentRun);

      const finalText = result.ok ? result.text : result.error;
      setMessages((prev) => prev.map((m) => (m.id === botMessageId ? { ...m, text: finalText } : m)));
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: input },
        { role: 'assistant', content: finalText },
      ];

      setBusy(false);
      setActivity(null);
    },
    [busy, settings],
  );

  return { messages, busy, activity, send };
}
