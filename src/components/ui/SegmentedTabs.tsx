import { cn } from '@/src/lib/cn';

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 分段控件，对应原型 .tabs/.tab-btn 与 .seg/.seg button（同一套视觉） */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-0.5 rounded-[11px] bg-black/[.045] p-[2.5px]', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-[29px] flex-1 rounded-[8.5px] text-[12.5px] font-semibold transition',
              active
                ? 'bg-white text-accent-ink shadow-[0_3px_9px_-2px_rgba(45,86,220,.24),0_0_0_.5px_var(--color-hairsoft)]'
                : 'text-sub hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
