/**
 * WHAT: Implements the edit-card-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveSelectionTarget } from '@frontend/business/selection/helper/resolve-selection-target.js';
import { calculateDragDelta } from '@frontend/business/gesture/helper/calculate-drag-delta.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderCardLayer } from '@frontend/business/card/effect/render-card-layer.js';
import { parseCardMarkdown } from '@frontend/business/card/helper/parse-card-markdown.js';

type AnyRecord = Record<string, unknown>;

export async function editCardController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
  const delta = calculateDragDelta({ action_payload: payload, runtime_state: runtime, data_model: data });
  const markdown = parseCardMarkdown({ action_payload: payload, runtime_state: runtime, data_model: data });
  commitLedgerEdit({ action_payload: { ...payload, target, delta, markdown }, runtime_state: runtime, data_model: data });
  renderCardLayer({ action_payload: { ...payload, target, delta, markdown }, runtime_state: runtime, data_model: data });
  return { ok: target.ok !== false && markdown.ok !== false, target, delta, markdown };
}

