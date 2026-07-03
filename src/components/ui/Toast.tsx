import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/src/lib/cn';
import { Icon } from '@/src/components/icons/Icon';

interface ToastContextValue {
  show: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2600;

/**
 * 全局 toast，对应原型 .toast。需挂在 position:relative 的容器（面板）内，
 * 用 useToast().show(text) 触发。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((next: string) => {
    setText(next);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        className={cn(
          'absolute bottom-[90px] left-1/2 z-[60] flex max-w-[88%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#191C21]/92 px-4 py-2.5 text-center text-[12.5px] text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,.45)] backdrop-blur-md transition-all duration-200',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
      >
        <Icon name="check" className="text-[#8CD9B4]" />
        <span>{text}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}
