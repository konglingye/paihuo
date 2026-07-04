import { useState } from 'react';
import { Icon } from '@/src/components/icons/Icon';

const QUICK_CHIPS = ['会议纪要发完了', 'PPT 不知道从哪下手'];

export interface ChatDockProps {
  busy: boolean;
  onSend: (text: string) => void;
}

/** 对话 dock：常驻在总览/活儿 tab 底部，快捷 chips + 输入条（对应原型 .dock） */
export function ChatDock({ busy, onSend }: ChatDockProps) {
  const [text, setText] = useState('');

  function submit(value: string) {
    if (busy || !value.trim()) return;
    onSend(value);
    setText('');
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-[rgba(252,252,253,.92)] from-42% to-transparent px-3.5 pb-3.5 pt-3 backdrop-blur-sm">
      <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => submit(chip)}
            className="flex-none rounded-full border border-hairsoft bg-white px-3 py-1.5 text-[12px] text-sub shadow-card transition hover:border-hair hover:text-ink"
          >
            {chip}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-center gap-1.5 rounded-full border border-hairsoft bg-white py-[5px] pl-2 pr-[5px] shadow-[0_6px_20px_-8px_rgba(20,24,30,.18),0_1px_2px_rgba(20,24,30,.05)]"
      >
        <span className="orb" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="跟小派说点什么…"
          aria-label="对话输入"
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="发送"
          className="btn-gradient flex h-8 w-8 flex-none items-center justify-center rounded-full text-white transition disabled:opacity-50"
        >
          <Icon name="plane" className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
