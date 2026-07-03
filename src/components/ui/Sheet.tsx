import type { ReactNode } from 'react';
import { cn } from '@/src/lib/cn';
import { Icon } from '@/src/components/icons/Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  statusText?: string;
  avatar?: ReactNode;
  heightClassName?: string;
  children: ReactNode;
}

/**
 * 底部抽屉，对应原型 .scrim + .sheet。
 * 需挂在 position:relative 的容器（面板）内。
 */
export function Sheet({ open, onClose, title, statusText, avatar, heightClassName, children }: SheetProps) {
  return (
    <>
      <div
        className={cn(
          'absolute inset-0 z-40 bg-[#181B20]/32 backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={title}
        className={cn(
          'absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[22px] rounded-b-panel border-t border-hairsoft bg-[#FDFDFE]/97 shadow-[0_-14px_44px_-14px_rgba(20,24,30,.28)] backdrop-blur-xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
          heightClassName ?? 'h-[76%]',
        )}
      >
        <div className="mx-auto mt-[7px] h-1 w-[34px] flex-none rounded-full bg-black/[.14]" aria-hidden="true" />
        <div className="flex flex-none items-center gap-2.5 border-b border-hairsoft px-4 pb-2.5 pt-3">
          {avatar}
          <div>
            <b className="text-[13.5px]">{title}</b>
            {statusText && (
              <div className="flex items-center gap-1 text-[11px] text-sub before:block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#2BA26D]">
                {statusText}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-sub hover:bg-gray-soft hover:text-ink"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
