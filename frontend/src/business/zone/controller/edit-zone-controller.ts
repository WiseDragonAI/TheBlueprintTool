/**
 * WHAT: Implements the edit-zone-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';
import { validateZoneDraft } from '@frontend/business/zone/helper/validate-zone-draft.js';
import { calculateZoneGeometry } from '@frontend/business/zone/helper/calculate-zone-geometry.js';
import { resolveZoneSelectionMembership } from '@frontend/business/zone/helper/resolve-zone-selection-membership.js';
import { confirmZoneDeletion } from '@frontend/business/zone/helper/confirm-zone-deletion.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderZoneLayer } from '@frontend/business/zone/effect/render-zone-layer.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';

type AnyRecord = Record<string, unknown>;

export async function editZoneController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
  const draft = validateZoneDraft({ action_payload: payload, runtime_state: runtime, data_model: data });
  const geometry = calculateZoneGeometry({ action_payload: payload, runtime_state: runtime, data_model: data });
  const membership = resolveZoneSelectionMembership({ action_payload: payload, runtime_state: runtime, data_model: data });
  const deletion = confirmZoneDeletion({ action_payload: payload, runtime_state: runtime, data_model: data });
  if (draft.ok !== false && deletion.ok !== false) {
    commitLedgerEdit({ action_payload: { ...payload, tool, draft, geometry, membership, deletion }, runtime_state: runtime, data_model: data });
  }
  renderZoneLayer({ action_payload: { ...payload, tool, draft, geometry, membership, deletion }, runtime_state: runtime, data_model: data });
  renderCanvasSurface({ action_payload: payload, runtime_state: runtime, data_model: data });
  return { ok: draft.ok !== false && deletion.ok !== false, tool, draft, geometry, membership, deletion };
}

