/**
 * WHAT: Implements the boot-surface-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { deriveRouteState } from '@frontend/business/navigation/helper/derive-route-state.js';
import { loadLedgerState } from '@frontend/business/boot/helper/load-ledger-state.js';
import { clearTransientSelection } from '@frontend/business/selection/helper/clear-transient-selection.js';
import { renderTabRegistry } from '@frontend/business/navigation/effect/render-tab-registry.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';

type AnyRecord = Record<string, unknown>;

export async function bootSurfaceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const route = deriveRouteState({ action_payload: payload, runtime_state: runtime, data_model: data });
  const ledger = loadLedgerState({ action_payload: payload, runtime_state: runtime, data_model: data });
  clearTransientSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
  renderTabRegistry({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
  renderCanvasSurface({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
  return { ok: route.ok !== false && ledger.ok !== false, route, ledger };
}

