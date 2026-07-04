import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, extensionOf, isAllowedAttachment } from './attachmentWhitelist';

describe('extensionOf', () => {
  it('取文件名最后一段扩展名并转小写', () => {
    expect(extensionOf('会议纪要.PDF')).toBe('pdf');
    expect(extensionOf('report.v2.docx')).toBe('docx');
  });

  it('没有扩展名时返回空字符串', () => {
    expect(extensionOf('makefile')).toBe('');
  });
});

describe('isAllowedAttachment（spec §3.2 白名单）', () => {
  it.each(ALLOWED_EXTENSIONS)('.%s 在白名单内', (ext) => {
    expect(isAllowedAttachment(`file.${ext}`)).toBe(true);
  });

  it.each(['exe', 'sh', 'bat', 'zip', 'mp4'])('.%s 被拒', (ext) => {
    expect(isAllowedAttachment(`file.${ext}`)).toBe(false);
  });
});
