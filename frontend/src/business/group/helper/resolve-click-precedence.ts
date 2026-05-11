/**
 * WHAT: Implements the resolve-click-precedence helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveClickPrecedence(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-click-precedence', { role: 'helper', action: 'resolve-click-precedence' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const targetType = String(payload.targetType ?? payload.target_type ?? 'group');
  const precedence = targetType === 'card' ? ['card', 'group', 'zone'] : ['group', 'zone', 'card'];
  return { ok: true, targetType, precedence, selectedTarget: precedence[0] };
}

