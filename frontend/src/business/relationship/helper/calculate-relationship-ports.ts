/**
 * WHAT: Implements the calculate-relationship-ports helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function calculateRelationshipPorts(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('calculate-relationship-ports', { role: 'helper', action: 'calculate-relationship-ports' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const source = (payload.source && typeof payload.source === 'object' ? payload.source : {}) as AnyRecord;
  const target = (payload.target && typeof payload.target === 'object' ? payload.target : {}) as AnyRecord;
  const sourcePort = { x: Number(source.x ?? 0) + Number(source.width ?? 120), y: Number(source.y ?? 0) + Number(source.height ?? 80) / 2 };
  const targetPort = { x: Number(target.x ?? 240), y: Number(target.y ?? 0) + Number(target.height ?? 80) / 2 };
  return { ok: true, sourcePort, targetPort };
}

