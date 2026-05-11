/**
 * WHAT: Implements the resolve-zone-selection-membership helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveZoneSelectionMembership(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-zone-selection-membership', { role: 'helper', action: 'resolve-zone-selection-membership' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const selectedIds = Array.isArray(payload.selectedIds) ? payload.selectedIds : Array.isArray(runtime.selectedIds) ? runtime.selectedIds : [];
  const zoneId = String(payload.zoneId ?? runtime.zoneId ?? 'zone-default');
  return { ok: true, zoneId, selectedIds, containsSelection: selectedIds.length > 0 };
}

