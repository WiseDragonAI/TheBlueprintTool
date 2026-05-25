/**
 * WHAT: Reads an incoming HTTP request body into a Buffer.
 * WHY: Voice transcription uploads arrive as raw browser-recorded audio bytes.
 */
import { type IncomingMessage } from 'node:http';

export function readRequestBuffer(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', () => resolve(Buffer.alloc(0)));
  });
}
