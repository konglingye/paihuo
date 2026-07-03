import type { ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

type PillVariant = 'due' | 'due-hot' | 'fit-full' | 'fit-assist' | 'fit-self';

interface PillProps {
  variant: PillVariant;
  children: ReactNode;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  due: 'bg-gray-soft text-gray-ink',
  'due-hot': 'bg-red-soft text-red',
  'fit-full': 'bg-ok-soft text-ok',
  'fit-assist': 'bg-accent-soft text-accent-ink',
  'fit-self': 'bg-gray-soft text-gray-ink',
};

/** 徽标 pill，对应原型 .pill（due / fit-full / fit-assist / fit-self） */
export function Pill({ variant, children, icon }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide',
        VARIANT_CLASSES[variant],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
