/**
 * WHAT: Parses the small multipart body used by voice uploads.
 * WHY: Voice upload parameters belong in the POST body alongside the audio blob.
 */
export type MultipartFile = {
  name: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type MultipartFormData = {
  fields: Record<string, string>;
  files: Record<string, MultipartFile>;
};

function boundaryFromContentType(contentType: string): string {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return String(match?.[1] ?? match?.[2] ?? '').trim();
}

function dispositionValue(disposition: string, key: string): string {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`));
  return String(match?.[1] ?? '');
}

export function parseMultipartFormData(body: Buffer, contentType: string): MultipartFormData {
  const boundary = boundaryFromContentType(contentType);
  if (!boundary) return { fields: {}, files: {} };
  const fields: Record<string, string> = {};
  const files: Record<string, MultipartFile> = {};
  const marker = `--${boundary}`;
  const raw = body.toString('latin1');
  const parts = raw.split(marker).slice(1, -1);
  for (const part of parts) {
    const normalized = part.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    const headerEnd = normalized.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headerLines = normalized.slice(0, headerEnd).split(/\r\n/);
    const content = normalized.slice(headerEnd + 4);
    const headers = new Map<string, string>();
    for (const line of headerLines) {
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
    }
    const disposition = headers.get('content-disposition') ?? '';
    const name = dispositionValue(disposition, 'name');
    if (!name) continue;
    const filename = dispositionValue(disposition, 'filename');
    if (!filename) {
      fields[name] = Buffer.from(content, 'latin1').toString('utf8');
      continue;
    }
    files[name] = {
      name,
      filename,
      mimeType: headers.get('content-type') ?? 'application/octet-stream',
      buffer: Buffer.from(content, 'latin1')
    };
  }
  return { fields, files };
}
