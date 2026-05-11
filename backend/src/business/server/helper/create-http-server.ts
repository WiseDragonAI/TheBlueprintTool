/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function createHttpServer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('create-http-server', { role: 'helper', action: 'create-http-server' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const port = Number(payload.port ?? runtime.port ?? 0);
  if (payload.mode === 'dry-run') {
    return { ok: true, port, server: { listening: false, port } };
  }
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    const frontendRoot = existsSync(resolve(process.cwd(), 'frontend'))
      ? resolve(process.cwd(), 'frontend')
      : resolve(process.cwd(), '..', 'frontend');
    const assetPath = url.startsWith('/assets/') ? resolve(frontendRoot, url.slice(1)) : resolve(frontendRoot, 'index.html');
    if ((url === '/' || url.startsWith('/assets/')) && existsSync(assetPath)) {
      response.setHeader('content-type', contentTypeFor(assetPath));
      response.end(readFileSync(assetPath));
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, method: request.method, url }));
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}

function contentTypeFor(filePath: string): string {
  const extension = extname(filePath);
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  return 'text/html; charset=utf-8';
}
