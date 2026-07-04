import { useRef } from 'react';
import { Icon } from '@/src/components/icons/Icon';
import { useToast } from '@/src/components/ui';
import { useFragmentsStore } from '@/src/store';
import { extensionOf, isAllowedAttachment } from '@/src/content/attachmentWhitelist';
import { parseAttachmentText, type ParsedAttachment } from '@/src/content/parseAttachment';
import type { Fragment } from '@/src/store/schema';

export interface AttachButtonProps {
  /** 提供时接管解析结果（不会自动写 fragmentsStore），用于倒活面板等需要先攒起来一起提交的场景 */
  onFile?: (file: { name: string; parsed: ParsedAttachment }) => void;
  /** 不传 onFile 时的默认行为：直接创建一个独立 fragment（如 /components 演示页） */
  onAttached?: (fragment: Fragment) => void;
}

/** 附件按钮：拒收不在白名单内的文件（原型文案），命中的解析成文本 */
export function AttachButton({ onFile, onAttached }: AttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const addFragment = useFragmentsStore((s) => s.addFragment);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (!isAllowedAttachment(file.name)) {
        show(`.${extensionOf(file.name) || '未知'} 这类文件帮不上忙——支持 pdf / txt / word / 表格和截图`);
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await parseAttachmentText(file.name, buffer);
        if (onFile) {
          onFile({ name: file.name, parsed });
          continue;
        }
        const fragment = addFragment({
          raw: parsed.text,
          attachments: [{ name: file.name, text: parsed.isImage ? undefined : parsed.text }],
        });
        onAttached?.(fragment);
      } catch (err) {
        show(`${file.name} 解析失败：${err instanceof Error ? err.message : '未知错误'}`);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="上传文件"
        onClick={() => inputRef.current?.click()}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sub hover:bg-gray-soft hover:text-ink"
      >
        <Icon name="clip" />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        data-testid="attachment-input"
        accept=".pdf,.txt,.md,.doc,.docx,.csv,.xls,.xlsx,image/*"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
