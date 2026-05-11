/**
 * WHAT: Implements the derive-gesture-intent helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function deriveGestureIntent(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('derive-gesture-intent', { role: 'helper', action: 'derive-gesture-intent' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const type = String(payload.gesture ?? payload.type ?? payload.action ?? 'select');
  const valid = !['invalid', 'unknown'].includes(type);
  return { ok: valid, intent: valid ? type : 'invalid', isMarquee: type === 'marquee' || type === 'select', isPan: type === 'pan', isZoom: type === 'zoom', isDrag: type === 'drag', isCopy: type === 'copy', isPaste: type === 'paste' };
}

