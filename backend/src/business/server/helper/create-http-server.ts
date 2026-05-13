/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  const server = createServer(async (request, response) => {
    const url = (request.url ?? '/').split('?')[0];
    const frontendRoot = existsSync(resolve(process.cwd(), 'frontend'))
      ? resolve(process.cwd(), 'frontend')
      : resolve(process.cwd(), '..', 'frontend');
    if (url.startsWith('/blueprinttool/')) {
      const blueprinttoolRoot = existsSync(resolve(process.cwd(), '.blueprinttool'))
        ? resolve(process.cwd(), '.blueprinttool')
        : resolve(process.cwd(), '..', '.blueprinttool');
      const tabId = url.split('/').filter(Boolean)[1] ?? 'state';
      const statePath = resolve(blueprinttoolRoot, 'state.json');
      const blueprintState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as { tabs?: Array<{ id?: string; ledgerFile?: string }> } : { tabs: [] };
      const tab = tabId === 'state' ? undefined : blueprintState.tabs?.find((entry) => entry.id === tabId);
      const ledgerFile = tabId === 'state' ? 'state.json' : String(tab?.ledgerFile ?? '').replace(/^\.blueprinttool\//, '');
      const ledgerPath = resolve(blueprinttoolRoot, ledgerFile);
      response.setHeader('content-type', 'application/json');
      if (!ledgerFile) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, missing: tabId }));
        return;
      }
      if (tabId !== 'state' && request.method !== 'GET' && existsSync(ledgerPath)) {
        const body = await new Promise<string>((resolveBody) => {
          let chunks = '';
          request.setEncoding('utf8');
          request.on('data', (chunk) => {
            chunks += chunk;
          });
          request.on('end', () => resolveBody(chunks));
          request.on('error', () => resolveBody(''));
        });
        const mutation = body ? JSON.parse(body) as { action?: string; annotation?: Record<string, unknown>; zoneIds?: string[] } : {};
        const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { annotations?: Array<Record<string, unknown>> };
        if (mutation.action === 'create-zone' && mutation.annotation?.id) {
          const id = String(mutation.annotation.id);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.annotation);
        }
        if (mutation.action === 'delete-zones') {
          const ids = new Set(mutation.zoneIds ?? []);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => entry.variant === 'group' || !ids.has(String(entry.id ?? '')));
        }
        writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
        response.end(JSON.stringify(ledger));
        return;
      }
      response.end(existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : JSON.stringify({ ok: false, missing: ledgerPath }));
      return;
    }
    const isAssetRoute = url.startsWith('/assets/') || url.startsWith('/src/');
    const blueprinttoolRoot = existsSync(resolve(process.cwd(), '.blueprinttool'))
      ? resolve(process.cwd(), '.blueprinttool')
      : resolve(process.cwd(), '..', '.blueprinttool');
    const statePath = resolve(blueprinttoolRoot, 'state.json');
    const blueprintState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as { tabs?: Array<{ id?: string }> } : { tabs: [] };
    const routeTabId = url.split('/').filter(Boolean)[0] ?? '';
    const isLedgerRoute = Boolean(routeTabId && blueprintState.tabs?.some((tab) => tab.id === routeTabId));
    const isAppRoute = url === '/' || isLedgerRoute;
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
