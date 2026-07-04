import { useState } from 'react';
import { Icon } from '@/src/components/icons/Icon';
import { Button, SegmentedTabs, useToast } from '@/src/components/ui';
import { AttachButton } from '@/src/components/attachments/AttachButton';
import { useTasksStore } from '@/src/store';
import { useReportTemplateStore } from '@/src/store/reportTemplateStore';
import { useReportRun } from './useReportRun';
import type { ReportKind } from '@/src/store/schema';

const KIND_OPTIONS: { value: ReportKind; label: string }[] = [
  { value: 'daily', label: '日报' },
  { value: 'weekly', label: '周报' },
  { value: 'monthly', label: '月报' },
];
const KIND_LABEL: Record<ReportKind, string> = { daily: '日报', weekly: '周报', monthly: '月报' };

/** 汇报 tab（spec §3.3）：分段选报告类型 + 可选模板上传 + 流式生成 + 复制/下载 .md */
export function ReportPanel() {
  const [kind, setKind] = useState<ReportKind>('daily');
  const tasksById = useTasksStore((s) => s.tasks);
  const template = useReportTemplateStore((s) => s.template);
  const setTemplate = useReportTemplateStore((s) => s.setTemplate);
  const clearTemplate = useReportTemplateStore((s) => s.clearTemplate);
  const { text, busy, error, generate } = useReportRun();
  const { show } = useToast();

  const tasks = Object.values(tasksById);
  const done = tasks.filter((t) => t.status === 'done').length;
  const open = tasks.length - done;

  function handleKindChange(next: ReportKind) {
    setKind(next);
  }

  async function handleGenerate() {
    await generate(kind);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪贴板权限不可用时忽略——用户仍能从输出框手动选取复制
    }
    show(`${KIND_LABEL[kind]}已复制——粘到飞书或邮件就能发`);
  }

  function handleDownload() {
    try {
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${KIND_LABEL[kind]}-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      show('已开始下载 .md');
    } catch {
      show('浏览器拦了下载——建议先复制全文');
    }
  }

  return (
    <div className="p-3.5">
      <SegmentedTabs options={KIND_OPTIONS} value={kind} onChange={handleKindChange} className="mb-3" />

      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        将基于本机任务记录来写：<b className="text-ink">完成 {done} 件 · 进行中 {open} 件</b>
        。写完可复制进飞书 / 邮件，或下载文件。
      </p>

      <div className="mb-3 flex items-center gap-1.5">
        {template ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairsoft bg-wash px-2.5 py-1.5 text-[11.5px] text-sub">
            <Icon name="note" className="h-3 w-3 text-accent-ink" />
            {template.name}
            <button
              type="button"
              aria-label="移除模板"
              onClick={clearTemplate}
              className="text-faint hover:text-red"
            >
              <Icon name="x" className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : (
          <AttachButton onFile={({ name, parsed }) => setTemplate({ name, text: parsed.text ?? '' })} />
        )}
        {!template && <span className="text-[11.5px] text-faint">上传公司模板（可选）</span>}
      </div>

      <Button variant="primary" size="md" className="w-full" disabled={busy} onClick={handleGenerate}>
        <Icon name="spark" className="h-3.5 w-3.5" />
        让 AI 写{KIND_LABEL[kind]}
      </Button>

      {template && text && !busy && (
        <p className="mt-2.5 rounded-lg bg-[#FBF3E0] px-2.5 py-1.5 text-[11.5px] text-[#8F6710]">
          已按模板「{template.name}」的结构组织
        </p>
      )}

      {error && <p className="mt-2.5 rounded-lg bg-red-soft px-2.5 py-1.5 text-[11.5px] text-red">{error}</p>}

      {(text || busy) && (
        <div className="mt-3 whitespace-pre-wrap rounded-xl border border-hairsoft bg-white p-3 text-[12px] leading-relaxed text-[#33373D] shadow-card">
          {text || '…'}
        </div>
      )}

      {text && !busy && (
        <div className="mt-2.5 flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={handleCopy}>
            <Icon name="copy" className="h-3.5 w-3.5" />
            复制全文
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Icon name="dl" className="h-3.5 w-3.5" />
            下载 .md
          </Button>
        </div>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        内容基于本机任务记录，由你接入的模型生成；上传模板后会按模板的结构和口径来写。
      </p>
    </div>
  );
}
