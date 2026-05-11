/**
 * WHAT: Implements the calculate-drag-delta helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function calculateDragDelta(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('calculate-drag-delta', { role: 'helper', action: 'calculate-drag-delta' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const from = (payload.from && typeof payload.from === 'object' ? payload.from : {}) as AnyRecord;
  const to = (payload.to && typeof payload.to === 'object' ? payload.to : payload.pointer ?? {}) as AnyRecord;
  return { ok: true, dx: Number(to.x ?? payload.dx ?? 0) - Number(from.x ?? 0), dy: Number(to.y ?? payload.dy ?? 0) - Number(from.y ?? 0) };
}

