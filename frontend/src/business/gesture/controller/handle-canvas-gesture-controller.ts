// @ts-nocheck
/**
 * WHAT: Generated controller function handle-canvas-gesture-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { calculateDragDelta } from '@frontend/business/gesture/helper/calculate-drag-delta.js';
import { calculateMarqueeSelection } from '@frontend/business/selection/helper/calculate-marquee-selection.js';
import { calculateViewportTransform } from '@frontend/business/canvas/helper/calculate-viewport-transform.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { copySelectionPayload } from '@frontend/business/selection/helper/copy-selection-payload.js';
import { deriveGestureIntent } from '@frontend/business/gesture/helper/derive-gesture-intent.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { resolveSelectionTarget } from '@frontend/business/selection/helper/resolve-selection-target.js';

export async function handleCanvasGestureController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:handle-canvas-gesture-controller -> start', { functionName: 'handle-canvas-gesture-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:handle-canvas-gesture-controller -> handle-canvas-gesture-controller-started', { functionName: 'handle-canvas-gesture-controller', phase: 'event' });
    try {
      await deriveGestureIntent({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'derive-gesture-intent', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:handle-canvas-gesture-controller -> handle-canvas-gesture-invalid', { functionName: 'handle-canvas-gesture-controller', phase: 'event' });
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveSelectionTarget({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'resolve-selection-target', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateMarqueeSelection({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'calculate-marquee-selection', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateViewportTransform({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'calculate-viewport-transform', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateDragDelta({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'calculate-drag-delta', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await commitLedgerEdit({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'commit-ledger-edit', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await copySelectionPayload({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'copy-selection-payload', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-canvas-gesture-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:handle-canvas-gesture-controller -> handle-canvas-gesture-controller-completed', { functionName: 'handle-canvas-gesture-controller', phase: 'event' });
  } finally {
    telemetry('controller:handle-canvas-gesture-controller -> complete', { functionName: 'handle-canvas-gesture-controller', phase: 'completed', arguments: input });
  }
}
