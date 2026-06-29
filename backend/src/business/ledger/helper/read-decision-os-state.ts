/**
 * WHAT: Implements the read-decision-os-state helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '@backend/business/server/helper/resolve-decision-os-root.js';
import { normalizeDecisionOsState } from './normalize-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

export function readDecisionOsState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('read-decision-os-state', { role: 'helper', action: 'read-decision-os-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
  const file = payload.decisionOsFile ? resolve(String(payload.decisionOsFile)) : resolve(decisionOsRoot, 'state.json');
  if (payload.mode === 'dry-run' || !existsSync(file)) {
    return { ok: true, file, ledgers: [{ id: 'default', title: 'Default', ledgerFile: String(payload.master_ledger_file ?? 'generated-master-ledger.md') }] };
  }
  return { ok: true, file, ...normalizeDecisionOsState(JSON.parse(readFileSync(file, 'utf8'))).state };
}
