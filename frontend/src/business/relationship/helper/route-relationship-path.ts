/**
 * WHAT: Implements the route-relationship-path helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function routeRelationshipPath(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('route-relationship-path', { role: 'helper', action: 'route-relationship-path' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const sourcePort = (payload.sourcePort && typeof payload.sourcePort === 'object' ? payload.sourcePort : { x: 0, y: 40 }) as AnyRecord;
  const targetPort = (payload.targetPort && typeof payload.targetPort === 'object' ? payload.targetPort : { x: 240, y: 40 }) as AnyRecord;
  const midX = (Number(sourcePort.x ?? 0) + Number(targetPort.x ?? 240)) / 2;
  const path = 'M ' + Number(sourcePort.x ?? 0) + ' ' + Number(sourcePort.y ?? 0) + ' C ' + midX + ' ' + Number(sourcePort.y ?? 0) + ', ' + midX + ' ' + Number(targetPort.y ?? 0) + ', ' + Number(targetPort.x ?? 240) + ' ' + Number(targetPort.y ?? 0);
  return { ok: true, path };
}

