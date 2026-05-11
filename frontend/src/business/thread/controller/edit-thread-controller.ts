/**
 * WHAT: Implements the edit-thread-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveThreadTarget } from '@frontend/business/thread/helper/resolve-thread-target.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderThreadPanel } from '@frontend/business/thread/effect/render-thread-panel.js';

type AnyRecord = Record<string, unknown>;

export async function editThreadController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const target = resolveThreadTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
  if (target.ok !== false) {
    commitLedgerEdit({ action_payload: { ...payload, target }, runtime_state: runtime, data_model: data });
  }
  renderThreadPanel({ action_payload: { ...payload, target }, runtime_state: runtime, data_model: data });
  return { ok: target.ok !== false, target };
}

