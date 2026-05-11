// @ts-nocheck
/**
 * WHAT: Generated controller function edit-group-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { calculateDragDelta } from '@frontend/business/gesture/helper/calculate-drag-delta.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderGroupLayer } from '@frontend/business/group/effect/render-group-layer.js';
import { resolveClickPrecedence } from '@frontend/business/group/helper/resolve-click-precedence.js';
import { resolveGroupMembership } from '@frontend/business/group/helper/resolve-group-membership.js';
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';

export async function editGroupController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:edit-group-controller -> start', { functionName: 'edit-group-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:edit-group-controller -> edit-group-controller-started', { functionName: 'edit-group-controller', phase: 'event' });
    try {
      await resolveToolMode({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'resolve-tool-mode', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveClickPrecedence({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'resolve-click-precedence', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-group-controller -> edit-group-not-targeted', { functionName: 'edit-group-controller', phase: 'event' });
    try {
      await renderGroupLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'render-group-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveGroupMembership({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'resolve-group-membership', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateDragDelta({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'calculate-drag-delta', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await commitLedgerEdit({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'commit-ledger-edit', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderGroupLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'render-group-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-group-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-group-controller -> edit-group-controller-completed', { functionName: 'edit-group-controller', phase: 'event' });
  } finally {
    telemetry('controller:edit-group-controller -> complete', { functionName: 'edit-group-controller', phase: 'completed', arguments: input });
  }
}
