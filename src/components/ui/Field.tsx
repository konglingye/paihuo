import type { InputHTMLAttributes } from 'react';
import { cn } from '@/src/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** 带标签的输入框，对应原型 .field */
export function Field({ label, id, className, ...rest }: FieldProps) {
  return (
    <div className="mb-2.5">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-sub"
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(
          'h-9 w-full rounded-[10px] border border-hairsoft bg-white px-3 text-[12.5px] text-ink shadow-card transition',
          'focus:border-[rgba(61,111,252,.45)] focus:shadow-[0_0_0_3.5px_rgba(61,111,252,.1)] focus:outline-none',
          className,
        )}
        {...rest}
      />
    </div>
  );
}
