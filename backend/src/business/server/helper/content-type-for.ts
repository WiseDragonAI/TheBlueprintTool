import { extname } from 'node:path';

export function contentTypeFor(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js' || extension === '.mjs' || extension === '.ts') return 'text/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.md' || extension === '.txt' || extension === '.csv' || extension === '.log') return 'text/plain; charset=utf-8';
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.webm') return 'video/webm';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.zip') return 'application/zip';
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === '.xls') return 'application/vnd.ms-excel';
  if (extension === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}
