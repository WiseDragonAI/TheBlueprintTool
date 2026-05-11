/**
 * WHAT: Implements the resolve-group-membership helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveGroupMembership(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-group-membership', { role: 'helper', action: 'resolve-group-membership' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const selected = Array.isArray(payload.selectedIds) ? payload.selectedIds : Array.isArray(runtime.selectedIds) ? runtime.selectedIds : [];
  const groupId = String(payload.groupId ?? runtime.groupId ?? 'group-default');
  return { ok: true, groupId, memberIds: selected, hasMembers: selected.length > 0 };
}

