/**
 * WHAT: Implements the calculate-marquee-selection helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function calculateMarqueeSelection(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('calculate-marquee-selection', { role: 'helper', action: 'calculate-marquee-selection' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const items = Array.isArray(payload.items) ? payload.items : Array.isArray(data.cards) ? data.cards : [];
  const selectedIds = items.map((item) => item && typeof item === 'object' ? (item as AnyRecord).id : undefined).filter(Boolean);
  return { ok: true, selectedIds, count: selectedIds.length };
}

