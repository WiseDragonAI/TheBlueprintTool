/**
 * WHAT: Implements the edit-group-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';
import { resolveGroupMembership } from '@frontend/business/group/helper/resolve-group-membership.js';
import { resolveClickPrecedence } from '@frontend/business/group/helper/resolve-click-precedence.js';
import { calculateDragDelta } from '@frontend/business/gesture/helper/calculate-drag-delta.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderGroupLayer } from '@frontend/business/group/effect/render-group-layer.js';
import { resolveSelectionTarget } from '@frontend/business/selection/helper/resolve-selection-target.js';

type AnyRecord = Record<string, unknown>;

export async function editGroupController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
  const membership = resolveGroupMembership({ action_payload: payload, runtime_state: runtime, data_model: data });
  const precedence = resolveClickPrecedence({ action_payload: payload, runtime_state: runtime, data_model: data });
  const delta = calculateDragDelta({ action_payload: payload, runtime_state: runtime, data_model: data });
  commitLedgerEdit({ action_payload: { ...payload, tool, target, membership, precedence, delta }, runtime_state: runtime, data_model: data });
  renderGroupLayer({ action_payload: { ...payload, tool, target, membership, precedence, delta }, runtime_state: runtime, data_model: data });
  return { ok: tool.ok !== false && target.ok !== false && membership.ok !== false, tool, target, membership, precedence, delta };
}
