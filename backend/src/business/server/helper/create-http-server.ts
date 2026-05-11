/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer } from 'node:http';
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
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, method: request.method, url: request.url }));
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}
