/**
 * WHAT: Implements the validate-ledger-edit-payload helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function validateLedgerEditPayload(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('validate-ledger-edit-payload', { role: 'helper', action: 'validate-ledger-edit-payload' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const document = payload.document ?? payload.patch ?? payload;
  const valid = document !== null && typeof document === 'object';
  return { ok: valid, document, errors: valid ? [] : ['ledger edit payload must be an object'] };
}

