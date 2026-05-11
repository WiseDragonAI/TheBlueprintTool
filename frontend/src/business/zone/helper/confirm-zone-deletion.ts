/**
 * WHAT: Implements the confirm-zone-deletion helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function confirmZoneDeletion(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('confirm-zone-deletion', { role: 'helper', action: 'confirm-zone-deletion' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const requested = payload.delete === true || payload.action === 'delete';
  return { ok: !requested || payload.confirmed === true, requested, confirmed: payload.confirmed === true };
}

