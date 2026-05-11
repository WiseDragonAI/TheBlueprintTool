/**
 * WHAT: Implements the resolve-selection-target helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveSelectionTarget(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-selection-target', { role: 'helper', action: 'resolve-selection-target' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const targetId = String(payload.targetId ?? payload.cardId ?? payload.zoneId ?? payload.groupId ?? runtime.selectedId ?? 'selection-default');
  const targetType = String(payload.targetType ?? (payload.zoneId ? 'zone' : payload.groupId ? 'group' : 'card'));
  return { ok: targetId.length > 0, targetId, targetType };
}

