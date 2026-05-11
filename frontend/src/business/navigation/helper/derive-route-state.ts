/**
 * WHAT: Implements the derive-route-state helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function deriveRouteState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('derive-route-state', { role: 'helper', action: 'derive-route-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const activeNavTabId = String(payload.activeNavTabId ?? payload.tabId ?? runtime.activeNavTabId ?? 'default');
  const activeCanvasId = String(payload.activeCanvasId ?? payload.canvasId ?? runtime.activeCanvasId ?? 'main');
  return { ok: activeNavTabId.length > 0 && activeCanvasId.length > 0, activeNavTabId, activeCanvasId, route: { tabId: activeNavTabId, canvasId: activeCanvasId } };
}

