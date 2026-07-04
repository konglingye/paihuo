import { Icon } from '@/src/components/icons/Icon';
import { cn } from '@/src/lib/cn';
import type { GroupKind } from '@/src/store/schema';

export interface GroupHeaderProps {
  kind: GroupKind;
  label: string;
  relatedCount?: number;
}

/** 分组头三态：紧急（红点）/ 项目（蓝+link图标+关联数）/ 日常（灰点），对应原型 .group-h */
export function GroupHeader({ kind, label, relatedCount }: GroupHeaderProps) {
  return (
    <div
      className={cn(
        'mb-2 mt-4 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide first:mt-0',
        kind === 'urgent' ? 'text-red' : kind === 'project' ? 'text-accent-ink' : 'text-faint',
      )}
    >
      {kind === 'project' ? (
        <Icon name="link" className="h-3 w-3" />
      ) : (
        <span className={cn('h-[5px] w-[5px] rounded-full', kind === 'urgent' ? 'bg-red' : 'bg-faint')} />
      )}
      {label}
      {relatedCount ? (
        <span className="ml-auto font-medium normal-case tracking-normal">{relatedCount} 件有关联</span>
      ) : null}
    </div>
  );
}
