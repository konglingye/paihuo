import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/src/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'success';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'btn-gradient text-white shadow-[0_2px_6px_-1px_rgba(45,86,220,.34)] hover:shadow-[0_4px_12px_-3px_rgba(45,86,220,.38)]',
  secondary:
    'bg-white text-sub border border-hairsoft shadow-card hover:border-hair hover:text-ink',
  success: 'bg-ok-soft text-ok',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-[34px] px-3.5 text-[12.5px]',
  md: 'h-10 px-4 text-[13px]',
};

/** 主/次按钮，对应原型 .btn-p / .btn-g / .ov-cta / .go */
export function Button({ variant = 'primary', size = 'sm', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-btn font-semibold transition active:scale-[.985]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
