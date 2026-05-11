/**
 * WHAT: Implements the read-ledger-json-file helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function readLedgerJsonFile(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('read-ledger-json-file', { role: 'helper', action: 'read-ledger-json-file' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const file = resolve(String(payload.ledgerFile ?? payload.master_ledger_file ?? 'generated-master-ledger.json'));
  if (payload.mode === 'dry-run' || !existsSync(file)) {
    return { ok: true, file, document: data.document ?? { tabs: [], cards: [], zones: [], relationships: [] } };
  }
  return { ok: true, file, document: JSON.parse(readFileSync(file, 'utf8')) };
}

