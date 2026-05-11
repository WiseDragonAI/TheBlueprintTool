/**
 * WHAT: Implements the parse-http-request helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function parseHttpRequest(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('parse-http-request', { role: 'helper', action: 'parse-http-request' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const method = String(payload.method ?? payload.requestMethod ?? 'GET').toUpperCase();
  const url = String(payload.url ?? payload.path ?? '/ledgers/default');
  return { ok: true, method, url, body: payload.body ?? payload.document ?? payload };
}

