/**
 * WHAT: Implements the load-ledger-state helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function loadLedgerState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('load-ledger-state', { role: 'helper', action: 'load-ledger-state' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const ok = payload.ok !== false;
  const tabs = Array.isArray(payload.tabs) ? payload.tabs : [{ id: payload.activeNavTabId ?? 'default', title: 'Default', canvasId: payload.activeCanvasId ?? 'main' }];
  const canvas = (payload.canvas && typeof payload.canvas === 'object' ? payload.canvas : data.canvas ?? {}) as AnyRecord;
  return { ok, tabs, canvas, ledger: { ...data, ...payload }, activeCanvasId: payload.activeCanvasId ?? 'main' };
}

