import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/src/components/ui';
import { Icon } from '@/src/components/icons/Icon';
import { AttachButton } from '@/src/components/attachments/AttachButton';
import { useTasksStore } from '@/src/store';
import { extensionOf } from '@/src/content/attachmentWhitelist';
import type { ChatAttachment, ChatMessageVM } from './useOrchestratorChat';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export interface ChatSheetProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessageVM[];
  busy: boolean;
  activity: string | null;
  onSend: (text: string, attachment?: ChatAttachment) => void;
}

/** 对话抽屉：消息流+活动指示+输入条（对应原型 .chat-sheet） */
export function ChatSheet({ open, onClose, messages, busy, activity, onSend }: ChatSheetProps) {
  const [text, setText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openTaskCount = useTasksStore((s) => Object.values(s.tasks).filter((t) => t.status !== 'done').length);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function submit() {
    if (busy || (!text.trim() && !pendingAttachment)) return;
    onSend(text, pendingAttachment ?? undefined);
    setText('');
    setPendingAttachment(null);
  }

  // 已经推进消息列表里、但还没收到第一个文字增量的占位气泡——期间只显示下面的活动指示，不显示空气泡
  const visibleMessages = messages.filter((m) => m.role === 'user' || m.text.length > 0);
  const showTyping = busy && messages.at(-1)?.role === 'bot' && !messages.at(-1)?.text;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="小派"
      statusText={`在线 · 手里记着 ${openTaskCount} 件活儿`}
      avatar={<span className="orb orb-lg" aria-hidden="true" />}
      heightClassName="h-[76%]"
    >
      <div className="flex h-full flex-col">
        <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5">
          {visibleMessages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'btn-gradient max-w-[86%] rounded-2xl rounded-br-[5px] px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_3px_10px_-4px_rgba(45,86,220,.38)]'
                    : 'max-w-[86%] rounded-2xl rounded-bl-[5px] border border-hairsoft bg-white px-3.5 py-2.5 text-[13px] leading-relaxed shadow-card'
                }
              >
                {m.attachmentName && (
                  <div className="mb-1 flex items-center gap-1.5 text-[11.5px] opacity-85">
                    <Icon name={IMAGE_EXTENSIONS.includes(extensionOf(m.attachmentName)) ? 'img' : 'note'} className="h-3 w-3" />
                    {m.attachmentName}
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {showTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-[5px] border border-hairsoft bg-white px-3.5 py-3 shadow-card">
                <span className="flex gap-[3px]">
                  <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:0ms]" />
                  <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:150ms]" />
                  <i className="h-1 w-1 animate-bounce rounded-full bg-sub [animation-delay:300ms]" />
                </span>
                {activity && (
                  <span
                    className="bg-[linear-gradient(90deg,#3D6FFC_20%,#9CBAFF_42%,#3D6FFC_62%)] bg-[length:200%_100%] bg-clip-text text-[12px] font-semibold text-transparent"
                    style={{ animation: 'aiflow 2.2s linear infinite' }}
                  >
                    {activity}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-none border-t border-hairsoft px-3.5 pb-4 pt-2.5">
          {pendingAttachment && (
            <div className="mb-2 flex">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairsoft bg-wash px-2 py-1 text-[11.5px] text-sub">
                <Icon name={IMAGE_EXTENSIONS.includes(extensionOf(pendingAttachment.name)) ? 'img' : 'note'} className="h-3 w-3 text-accent-ink" />
                {pendingAttachment.name}
                <button
                  type="button"
                  aria-label="移除附件"
                  onClick={() => setPendingAttachment(null)}
                  className="text-faint hover:text-red"
                >
                  <Icon name="x" className="h-2.5 w-2.5" />
                </button>
              </span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-1.5 rounded-full border border-hairsoft bg-white py-1 pl-1.5 pr-1 shadow-card"
          >
            <AttachButton
              onFile={({ name, parsed }) => setPendingAttachment({ name, text: parsed.isImage ? undefined : parsed.text })}
            />
            <input
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              placeholder="回一句…也可以丢文件、贴截图"
              aria-label="对话输入"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={busy || (!text.trim() && !pendingAttachment)}
              aria-label="发送"
              className="btn-gradient flex h-8 w-8 flex-none items-center justify-center rounded-full text-white disabled:opacity-50"
            >
              <Icon name="plane" className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </Sheet>
  );
}
