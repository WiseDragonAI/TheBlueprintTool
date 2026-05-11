// @ts-nocheck
/**
 * WHAT: Generated controller function edit-zone-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { calculateZoneGeometry } from '@frontend/business/zone/helper/calculate-zone-geometry.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { confirmZoneDeletion } from '@frontend/business/zone/helper/confirm-zone-deletion.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderZoneLayer } from '@frontend/business/zone/effect/render-zone-layer.js';
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';
import { resolveZoneSelectionMembership } from '@frontend/business/zone/helper/resolve-zone-selection-membership.js';
import { validateZoneDraft } from '@frontend/business/zone/helper/validate-zone-draft.js';

export async function editZoneController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:edit-zone-controller -> start', { functionName: 'edit-zone-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:edit-zone-controller -> edit-zone-controller-started', { functionName: 'edit-zone-controller', phase: 'event' });
    try {
      await resolveToolMode({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'resolve-tool-mode', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await validateZoneDraft({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'validate-zone-draft', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-zone-controller -> edit-zone-draft-rejected', { functionName: 'edit-zone-controller', phase: 'event' });
    try {
      await renderZoneLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'render-zone-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await calculateZoneGeometry({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'calculate-zone-geometry', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveZoneSelectionMembership({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'resolve-zone-selection-membership', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await confirmZoneDeletion({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'confirm-zone-deletion', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-zone-controller -> edit-zone-delete-cancelled', { functionName: 'edit-zone-controller', phase: 'event' });
    try {
      await renderZoneLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'render-zone-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await commitLedgerEdit({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'commit-ledger-edit', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderZoneLayer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'render-zone-layer', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-zone-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-zone-controller -> edit-zone-controller-completed', { functionName: 'edit-zone-controller', phase: 'event' });
  } finally {
    telemetry('controller:edit-zone-controller -> complete', { functionName: 'edit-zone-controller', phase: 'completed', arguments: input });
  }
}
