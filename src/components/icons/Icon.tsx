import { cn } from '@/src/lib/cn';

export type IconName =
  | 'plane'
  | 'sliders'
  | 'mic'
  | 'clip'
  | 'copy'
  | 'ext'
  | 'check'
  | 'chev'
  | 'clock'
  | 'spark'
  | 'link'
  | 'msg'
  | 'x'
  | 'plus'
  | 'arr'
  | 'reset'
  | 'zap'
  | 'lock'
  | 'inbox'
  | 'note'
  | 'grid'
  | 'dl'
  | 'img'
  | 'user';

interface IconProps {
  name: IconName;
  className?: string;
}

/** 内联 SVG 图标，引用 <IconSprite/> 挂载的 symbol 表 */
export function Icon({ name, className }: IconProps) {
  return (
    <svg className={cn('ic', className)} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
