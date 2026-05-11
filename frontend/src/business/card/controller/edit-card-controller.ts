// @ts-nocheck
/**
 * WHAT: Generated controller function edit-card-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { calculateDragDelta } from '@frontend/business/gesture/helper/calculate-drag-delta.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { parseCardMarkdown } from '@frontend/business/card/helper/parse-card-markdown.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderCardLayer } from '@frontend/business/card/effect/render-card-layer.js';
import { resolveSelectionTarget } from '@frontend/business/selection/helper/resolve-selection-target.js';

export async function editCardController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:edit-card-controller -> start', { functionName: 'edit-card-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:edit-card-controller -> edit-card-controller-started', { functionName: 'edit-card-controller', phase: 'event' });
    try {
      await resolveSelectionTarget({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'resolve-selection-target', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateDragDelta({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'calculate-drag-delta', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await commitLedgerEdit({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'commit-ledger-edit', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await parseCardMarkdown({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'parse-card-markdown', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCardLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'render-card-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-card-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-card-controller -> edit-card-controller-completed', { functionName: 'edit-card-controller', phase: 'event' });
  } finally {
    telemetry('controller:edit-card-controller -> complete', { functionName: 'edit-card-controller', phase: 'completed', arguments: input });
  }
}
