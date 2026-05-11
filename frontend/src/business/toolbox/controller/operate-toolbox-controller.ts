/**
 * WHAT: Implements the operate-toolbox-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveSelectionTarget } from '@frontend/business/selection/helper/resolve-selection-target.js';
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';
import { renderToolbox } from '@frontend/business/toolbox/effect/render-toolbox.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';

type AnyRecord = Record<string, unknown>;

export async function operateToolboxController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
  renderToolbox({ action_payload: { ...payload, target, tool }, runtime_state: runtime, data_model: data });
  renderCanvasSurface({ action_payload: { ...payload, target, tool }, runtime_state: runtime, data_model: data });
  return { ok: target.ok !== false && tool.ok !== false, target, tool };
}

