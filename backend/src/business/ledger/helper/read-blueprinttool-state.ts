/**
 * WHAT: Implements the read-blueprinttool-state helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveBlueprinttoolRoot } from '@backend/business/server/helper/resolve-blueprinttool-root.js';

type AnyRecord = Record<string, unknown>;

export function readBlueprinttoolState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('read-blueprinttool-state', { role: 'helper', action: 'read-blueprinttool-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const blueprinttoolRoot = resolveBlueprinttoolRoot({ action_payload: payload, runtime_state: runtime });
  const file = payload.blueprinttoolFile ? resolve(String(payload.blueprinttoolFile)) : resolve(blueprinttoolRoot, 'state.json');
  if (payload.mode === 'dry-run' || !existsSync(file)) {
    return { ok: true, file, tabs: [{ id: 'default', title: 'Default', ledgerFile: String(payload.master_ledger_file ?? 'generated-master-ledger.md') }] };
  }
  return { ok: true, file, ...JSON.parse(readFileSync(file, 'utf8')) };
}
