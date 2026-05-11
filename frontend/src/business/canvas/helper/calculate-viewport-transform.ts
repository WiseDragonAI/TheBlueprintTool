/**
 * WHAT: Implements the calculate-viewport-transform helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function calculateViewportTransform(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('calculate-viewport-transform', { role: 'helper', action: 'calculate-viewport-transform' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const zoom = Number(payload.zoom ?? runtime.zoom ?? 1);
  const pan = (payload.pan && typeof payload.pan === 'object' ? payload.pan : runtime.pan ?? {}) as AnyRecord;
  return { ok: Number.isFinite(zoom) && zoom > 0, scale: Number.isFinite(zoom) && zoom > 0 ? zoom : 1, x: Number(pan.x ?? 0), y: Number(pan.y ?? 0) };
}

