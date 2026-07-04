import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MarkdownViewProps {
  text: string;
}

/**
 * 汇报官的输出是 markdown 全文（标题/表格/加粗），之前直接当纯文本 white-space:pre-wrap 展示，
 * 用户看到的是一堆 # 和 | 符号。这里渲染成真正的富文本，react-markdown 转的是 React 元素不是
 * dangerouslySetInnerHTML，天然不会有 XSS 风险。
 */
export function MarkdownView({ text }: MarkdownViewProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-[15px] font-bold text-ink first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-[13.5px] font-bold text-ink first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-[12.5px] font-bold text-ink first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        hr: () => <hr className="my-2.5 border-hairsoft" />,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-accent-ink underline">
            {children}
          </a>
        ),
        code: ({ children }) => <code className="rounded bg-wash px-1 py-0.5 text-[11px]">{children}</code>,
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-hairsoft pl-2.5 text-sub">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto rounded-lg border border-hairsoft">
            <table className="w-full border-collapse text-left">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-wash">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b border-hairsoft px-2 py-1.5 text-[11.5px] font-semibold text-sub">{children}</th>
        ),
        td: ({ children }) => <td className="border-b border-hairsoft px-2 py-1.5 last:border-b-0">{children}</td>,
        tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
