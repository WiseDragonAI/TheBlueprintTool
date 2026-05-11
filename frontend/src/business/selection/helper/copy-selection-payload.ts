/**
 * WHAT: Implements the copy-selection-payload helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function copySelectionPayload(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('copy-selection-payload', { role: 'helper', action: 'copy-selection-payload' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const selectedIds = Array.isArray(payload.selectedIds) ? payload.selectedIds : Array.isArray(runtime.selectedIds) ? runtime.selectedIds : [];
  return { ok: true, clipboard: { ids: selectedIds, copiedAt: new Date(0).toISOString() }, selectedIds };
}

