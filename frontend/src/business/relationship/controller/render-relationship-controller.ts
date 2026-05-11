// @ts-nocheck
/**
 * WHAT: Generated controller function render-relationship-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { calculateRelationshipPorts } from '@frontend/business/relationship/helper/calculate-relationship-ports.js';
import { renderRelationshipOverlay } from '@frontend/business/relationship/effect/render-relationship-overlay.js';
import { routeRelationshipPath } from '@frontend/business/relationship/helper/route-relationship-path.js';

export async function renderRelationshipController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:render-relationship-controller -> start', { functionName: 'render-relationship-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:render-relationship-controller -> render-relationship-controller-started', { functionName: 'render-relationship-controller', phase: 'event' });
    try {
      await calculateRelationshipPorts({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'render-relationship-controller', dependencyName: 'calculate-relationship-ports', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await routeRelationshipPath({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'render-relationship-controller', dependencyName: 'route-relationship-path', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderRelationshipOverlay({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'render-relationship-controller', dependencyName: 'render-relationship-overlay', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:render-relationship-controller -> render-relationship-controller-completed', { functionName: 'render-relationship-controller', phase: 'event' });
  } finally {
    telemetry('controller:render-relationship-controller -> complete', { functionName: 'render-relationship-controller', phase: 'completed', arguments: input });
  }
}
