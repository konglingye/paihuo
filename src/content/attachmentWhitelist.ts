/** 附件白名单（spec §3.2） */
export const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp'];

export function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function isAllowedAttachment(filename: string): boolean {
  return ALLOWED_EXTENSIONS.includes(extensionOf(filename));
}
