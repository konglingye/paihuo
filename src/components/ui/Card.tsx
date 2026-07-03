import type { HTMLAttributes } from 'react';
import { cn } from '@/src/lib/cn';

/** 卡片容器，对应原型 .card */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-hairsoft bg-white shadow-card transition hover:border-hair hover:shadow-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
