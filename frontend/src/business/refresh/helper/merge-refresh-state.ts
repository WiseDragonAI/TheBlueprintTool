/**
 * WHAT: Implements the merge-refresh-state helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function mergeRefreshState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('merge-refresh-state', { role: 'helper', action: 'merge-refresh-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const refresh = (payload.refresh && typeof payload.refresh === 'object' ? payload.refresh : payload) as AnyRecord;
  return { ok: payload.ok !== false, mergedState: { ...runtime, ...refresh }, requiresFullReload: payload.requiresFullReload === true };
}

