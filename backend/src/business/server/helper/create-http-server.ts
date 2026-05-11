/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { telemetry } from '@backend/telemetry/harness.js';
import { contentTypeFor } from './content-type-for.js';

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
    if (url === '/blueprinttool/specs' || url === '/blueprinttool/data') {
      const ledgerPath = resolve(process.cwd(), '.blueprinttool', url.endsWith('/specs') ? 'specs.json' : 'data.json');
      response.setHeader('content-type', 'application/json');
      response.end(existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : JSON.stringify({ ok: false, missing: ledgerPath }));
      return;
    }
    const isAssetRoute = url.startsWith('/assets/') || url.startsWith('/src/');
    const isAppRoute = url === '/' || url === '/surface' || url === '/specs' || url === '/runtime';
    const requestedPath = isAssetRoute ? resolve(frontendRoot, url.slice(1)) : resolve(frontendRoot, 'index.html');
    const assetPath = existsSync(requestedPath) ? requestedPath : requestedPath.replace(/\.js$/, '.ts');
    if ((isAppRoute || isAssetRoute) && existsSync(assetPath)) {
      response.setHeader('content-type', contentTypeFor(assetPath));
      const source = readFileSync(assetPath, 'utf8');
      response.end(assetPath.endsWith('.ts') ? transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 } }).outputText : source);
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, method: request.method, url }));
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}
