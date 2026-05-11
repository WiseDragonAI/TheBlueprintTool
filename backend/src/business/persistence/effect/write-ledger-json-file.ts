/**
 * WHAT: Implements the write-ledger-json-file effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function writeLedgerJsonFile(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('write-ledger-json-file', { role: 'effect', action: 'write-ledger-json-file' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const document = payload.document ?? payload.patch ?? payload;
  runtime.lastLedgerDocument = document;
  if (payload.mode !== 'dry-run' && payload.ledgerFile) {
    const file = resolve(String(payload.ledgerFile));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(document, null, 2));
  }
}

