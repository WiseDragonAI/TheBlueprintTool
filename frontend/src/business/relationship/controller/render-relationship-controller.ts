/**
 * WHAT: Implements the render-relationship-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { calculateRelationshipPorts } from '@frontend/business/relationship/helper/calculate-relationship-ports.js';
import { routeRelationshipPath } from '@frontend/business/relationship/helper/route-relationship-path.js';
import { renderRelationshipOverlay } from '@frontend/business/relationship/effect/render-relationship-overlay.js';

type AnyRecord = Record<string, unknown>;

export async function renderRelationshipController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const ports = calculateRelationshipPorts({ action_payload: payload, runtime_state: runtime, data_model: data });
  const relationshipPath = routeRelationshipPath({ action_payload: { ...payload, ...ports }, runtime_state: runtime, data_model: data });
  renderRelationshipOverlay({ action_payload: { ...payload, ports, relationshipPath }, runtime_state: runtime, data_model: data });
  return { ok: ports.ok !== false && relationshipPath.ok !== false, ports, relationshipPath };
}

