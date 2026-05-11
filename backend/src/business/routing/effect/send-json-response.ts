/**
 * WHAT: Implements the send-json-response effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function sendJsonResponse(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('send-json-response', { role: 'effect', action: 'send-json-response' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  runtime.lastResponse = { status: Number(payload.status ?? 200), body: payload.body ?? payload.document ?? payload };
  const response = payload.response as { statusCode?: number; setHeader?: (name: string, value: string) => void; end?: (body: string) => void } | undefined;
  if (response) {
    response.statusCode = Number(payload.status ?? 200);
    response.setHeader?.('content-type', 'application/json');
    response.end?.(JSON.stringify(runtime.lastResponse));
  }
}

