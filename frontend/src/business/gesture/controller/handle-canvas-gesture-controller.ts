/**
 * WHAT: Implements the handle-canvas-gesture-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { deriveGestureIntent } from '@frontend/business/gesture/helper/derive-gesture-intent.js';
import { calculateMarqueeSelection } from '@frontend/business/selection/helper/calculate-marquee-selection.js';
import { calculateViewportTransform } from '@frontend/business/canvas/helper/calculate-viewport-transform.js';
import { clearTransientSelection } from '@frontend/business/selection/helper/clear-transient-selection.js';
import { copySelectionPayload } from '@frontend/business/selection/helper/copy-selection-payload.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';

type AnyRecord = Record<string, unknown>;

export async function handleCanvasGestureController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const intent = deriveGestureIntent({ action_payload: payload, runtime_state: runtime, data_model: data });
  const selection = calculateMarqueeSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
  const transform = calculateViewportTransform({ action_payload: payload, runtime_state: runtime, data_model: data });
  clearTransientSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
  const clipboard = copySelectionPayload({ action_payload: payload, runtime_state: runtime, data_model: data });
  renderCanvasSurface({ action_payload: { ...payload, intent, selection, transform, clipboard }, runtime_state: runtime, data_model: data });
  return { ok: intent.ok !== false, intent, selection, transform, clipboard };
}

