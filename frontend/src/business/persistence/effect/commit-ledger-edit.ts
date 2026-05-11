/**
 * WHAT: Implements the commit-ledger-edit effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function commitLedgerEdit(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('commit-ledger-edit', { role: 'effect', action: 'commit-ledger-edit' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const edits = Array.isArray(runtime.ledgerEdits) ? runtime.ledgerEdits : [];
  edits.push({ payload, committedAt: new Date(0).toISOString() });
  runtime.ledgerEdits = edits;
}

