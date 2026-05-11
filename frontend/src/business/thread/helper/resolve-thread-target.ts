/**
 * WHAT: Implements the resolve-thread-target helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveThreadTarget(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-thread-target', { role: 'helper', action: 'resolve-thread-target' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const targetId = String(payload.threadId ?? payload.cardId ?? runtime.threadId ?? 'thread-default');
  return { ok: targetId.length > 0, threadId: targetId, notes: Array.isArray(payload.notes) ? payload.notes : [] };
}

