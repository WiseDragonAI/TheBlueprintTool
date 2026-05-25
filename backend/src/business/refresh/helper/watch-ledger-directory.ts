/**
 * WHAT: Implements the watch-ledger-directory helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveBlueprinttoolRoot } from '@backend/business/server/helper/resolve-blueprinttool-root.js';

type AnyRecord = Record<string, unknown>;

export function watchLedgerDirectory(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('watch-ledger-directory', { role: 'helper', action: 'watch-ledger-directory' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const blueprinttoolRoot = resolveBlueprinttoolRoot({ action_payload: payload, runtime_state: runtime });
  const directory = resolve(String(payload.ledgerDirectory ?? blueprinttoolRoot));
  return { ok: true, directory, watching: payload.mode !== 'dry-run' };
}
