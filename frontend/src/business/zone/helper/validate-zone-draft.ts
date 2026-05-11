/**
 * WHAT: Implements the validate-zone-draft helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function validateZoneDraft(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('validate-zone-draft', { role: 'helper', action: 'validate-zone-draft' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const name = String(payload.name ?? payload.zoneName ?? 'Untitled zone').trim();
  const color = String(payload.color ?? '#5b7cfa');
  return { ok: name.length > 0 && color.length > 0, name, color, errors: name.length > 0 ? [] : ['zone name is required'] };
}

