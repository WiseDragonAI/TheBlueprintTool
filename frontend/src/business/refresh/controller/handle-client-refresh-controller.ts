/**
 * WHAT: Implements the handle-client-refresh-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { subscribeServerRefresh } from '@frontend/business/refresh/effect/subscribe-server-refresh.js';
import { loadLedgerState } from '@frontend/business/boot/helper/load-ledger-state.js';
import { mergeRefreshState } from '@frontend/business/refresh/helper/merge-refresh-state.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';

type AnyRecord = Record<string, unknown>;

export async function handleClientRefreshController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  subscribeServerRefresh({ action_payload: payload, runtime_state: runtime, data_model: data });
  const ledger = loadLedgerState({ action_payload: payload, runtime_state: runtime, data_model: data });
  const merged = mergeRefreshState({ action_payload: payload, runtime_state: runtime, data_model: data });
  renderCanvasSurface({ action_payload: { ...payload, ledger, merged }, runtime_state: runtime, data_model: data });
  return { ok: ledger.ok !== false && merged.ok !== false, ledger, merged };
}

