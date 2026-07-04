import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { parseAttachmentText } from './parseAttachment';

function textEncode(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

/** 手写一个最小可用的 PDF（pdf.js 能从损坏的 xref 表里自行扫描恢复对象） */
function buildMinimalPdf(text: string): ArrayBuffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 200 100] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${text.length + 20} >>
stream
BT /F1 12 Tf 10 50 Td (${text}) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
  return textEncode(content);
}

async function buildMinimalDocx(text: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

function buildMinimalXlsx(rows: string[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('parseAttachmentText（真实文件解析，不 mock）', () => {
  it('txt 直接按 UTF-8 解码', async () => {
    const result = await parseAttachmentText('note.txt', textEncode('随手记的一句话'));
    expect(result).toEqual({ text: '随手记的一句话', isImage: false });
  });

  it('md 直接按 UTF-8 解码', async () => {
    const result = await parseAttachmentText('note.md', textEncode('# 标题\n正文'));
    expect(result.text).toBe('# 标题\n正文');
  });

  it('pdf 用 pdfjs-dist 提取文本', async () => {
    const buffer = buildMinimalPdf('Hello PDF World');
    const result = await parseAttachmentText('doc.pdf', buffer);
    expect(result.text).toContain('Hello PDF World');
    expect(result.isImage).toBe(false);
  });

  it('docx 用 mammoth 提取文本', async () => {
    const buffer = await buildMinimalDocx('会议纪要正文内容');
    const result = await parseAttachmentText('doc.docx', buffer);
    expect(result.text).toContain('会议纪要正文内容');
  });

  it('xlsx 用 SheetJS 转成 CSV 文本', async () => {
    const buffer = buildMinimalXlsx([
      ['姓名', '区域', '销售额'],
      ['张三', '华东', '100'],
    ]);
    const result = await parseAttachmentText('data.xlsx', buffer);
    expect(result.text).toContain('姓名,区域,销售额');
    expect(result.text).toContain('张三,华东,100');
  });

  it('csv 也走同一条解析路径', async () => {
    const buffer = textEncode('a,b\n1,2');
    const result = await parseAttachmentText('data.csv', buffer);
    expect(result.text.replace(/\r\n/g, '\n').trim()).toBe('a,b\n1,2');
  });

  it('图片类型不提取文本，标记 isImage=true', async () => {
    const result = await parseAttachmentText('photo.png', textEncode('fake-binary'));
    expect(result).toEqual({ text: '', isImage: true });
  });

  it('不支持的扩展名抛出友好错误（如损坏或不支持的旧版 .doc 二进制格式）', async () => {
    await expect(parseAttachmentText('legacy.doc', textEncode('not a real doc'))).rejects.toThrow();
  });
});
