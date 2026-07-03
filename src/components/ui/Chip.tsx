import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/src/lib/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
}

/** 通用可选中 chip，对应原型 .fchip / .qchip / .preset / .mchip */
export function Chip({ active, count, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-[4.5px] text-[11.5px] font-semibold shadow-card transition',
        active
          ? 'btn-gradient border-transparent text-white'
          : 'border-hairsoft bg-white text-sub hover:border-hair hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <s className="ml-[3px] font-medium tabular-nums no-underline opacity-55">{count}</s>
      )}
    </button>
  );
}
