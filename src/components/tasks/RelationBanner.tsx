import { Icon } from '@/src/components/icons/Icon';
import type { Relation } from '@/src/store/schema';

export interface RelationBannerProps {
  relation: Relation;
  onGoToChat: () => void;
  onDismiss: () => void;
}

/** 关联横幅：整理官/拆解官发现可合并推进的任务时出现（spec §6.2），可关不删数据 */
export function RelationBanner({ relation, onGoToChat, onDismiss }: RelationBannerProps) {
  return (
    <div className="mb-3 rounded-card border border-[rgba(61,111,252,.2)] bg-accent-soft p-3 text-[12.5px] leading-relaxed text-[#33509F]">
      <div className="mb-1 flex items-center gap-1.5 font-bold text-accent-ink">
        <Icon name="link" className="h-3.5 w-3.5" />
        发现关联
      </div>
      <p>
        {relation.reason}
        {relation.suggestion ? `。${relation.suggestion}` : ''}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onGoToChat}
          className="rounded-full border border-[rgba(61,111,252,.25)] bg-white px-3 py-1.5 text-[12px] font-semibold text-accent-ink shadow-card"
        >
          好，先定关键信息
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-hairsoft bg-white px-3 py-1.5 text-[12px] font-semibold text-sub shadow-card"
        >
          分开做
        </button>
      </div>
    </div>
  );
}
