import { extname } from 'node:path';

export function contentTypeFor(filePath: string): string {
  const extension = extname(filePath);
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js' || extension === '.ts') return 'text/javascript; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'text/html; charset=utf-8';
}
