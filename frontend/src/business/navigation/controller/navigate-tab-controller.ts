// @ts-nocheck
/**
 * WHAT: Generated controller function navigate-tab-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { deriveRouteState } from '@frontend/business/navigation/helper/derive-route-state.js';
import { loadLedgerState } from '@frontend/business/boot/helper/load-ledger-state.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '@frontend/business/navigation/effect/render-tab-registry.js';

export async function navigateTabController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:navigate-tab-controller -> start', { functionName: 'navigate-tab-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:navigate-tab-controller -> navigate-tab-controller-started', { functionName: 'navigate-tab-controller', phase: 'event' });
    try {
      await deriveRouteState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'navigate-tab-controller', dependencyName: 'derive-route-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:navigate-tab-controller -> navigate-tab-route-missing', { functionName: 'navigate-tab-controller', phase: 'event' });
    try {
      await renderTabRegistry({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'navigate-tab-controller', dependencyName: 'render-tab-registry', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await loadLedgerState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'navigate-tab-controller', dependencyName: 'load-ledger-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderTabRegistry({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'navigate-tab-controller', dependencyName: 'render-tab-registry', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'navigate-tab-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:navigate-tab-controller -> navigate-tab-controller-completed', { functionName: 'navigate-tab-controller', phase: 'event' });
  } finally {
    telemetry('controller:navigate-tab-controller -> complete', { functionName: 'navigate-tab-controller', phase: 'completed', arguments: input });
  }
}
