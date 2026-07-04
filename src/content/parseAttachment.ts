import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { extensionOf } from './attachmentWhitelist';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export interface ParsedAttachment {
  text: string;
  /** 图片没有可提取的文本，发消息时按 spec §3.2 走多模态或提示用户把内容打成字 */
  isImage: boolean;
}

async function parsePdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pageTexts.join('\n\n');
}

async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  // mammoth 的 node 版本要 Buffer，浏览器版本要 arrayBuffer——按运行环境二选一
  const input = typeof Buffer !== 'undefined' ? { buffer: Buffer.from(arrayBuffer) } : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  return result.value.trim();
}

function parseSpreadsheet(arrayBuffer: ArrayBuffer): string {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return workbook.SheetNames.length > 1 ? `# ${name}\n${csv}` : csv;
  }).join('\n\n');
}

function decodeText(arrayBuffer: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(arrayBuffer);
}

/** txt/md 直读；pdf→pdfjs-dist；doc/docx→mammoth（老式二进制 .doc 其实解不了，会友好报错）；csv/xlsx→SheetJS */
export async function parseAttachmentText(filename: string, arrayBuffer: ArrayBuffer): Promise<ParsedAttachment> {
  const ext = extensionOf(filename);

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return { text: '', isImage: true };
  }
  if (ext === 'pdf') {
    return { text: await parsePdf(arrayBuffer), isImage: false };
  }
  if (ext === 'doc' || ext === 'docx') {
    return { text: await parseDocx(arrayBuffer), isImage: false };
  }
  if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
    return { text: parseSpreadsheet(arrayBuffer), isImage: false };
  }
  if (ext === 'txt' || ext === 'md') {
    return { text: decodeText(arrayBuffer), isImage: false };
  }
  throw new Error(`不支持的附件类型：.${ext || '未知'}`);
}
