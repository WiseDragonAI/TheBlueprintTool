// @ts-nocheck
/**
 * WHAT: Generated controller function boot-surface-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { clearTransientSelection } from '@frontend/business/selection/helper/clear-transient-selection.js';
import { deriveRouteState } from '@frontend/business/navigation/helper/derive-route-state.js';
import { loadLedgerState } from '@frontend/business/boot/helper/load-ledger-state.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '@frontend/business/navigation/effect/render-tab-registry.js';

export async function bootSurfaceController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:boot-surface-controller -> start', { functionName: 'boot-surface-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:boot-surface-controller -> boot-surface-controller-started', { functionName: 'boot-surface-controller', phase: 'event' });
    try {
      await deriveRouteState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'derive-route-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:boot-surface-controller -> boot-surface-first-launch-required', { functionName: 'boot-surface-controller', phase: 'event' });
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await loadLedgerState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'load-ledger-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:boot-surface-controller -> boot-surface-ledger-load-failed', { functionName: 'boot-surface-controller', phase: 'event' });
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await clearTransientSelection({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'clear-transient-selection', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderTabRegistry({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'render-tab-registry', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'boot-surface-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:boot-surface-controller -> boot-surface-controller-completed', { functionName: 'boot-surface-controller', phase: 'event' });
  } finally {
    telemetry('controller:boot-surface-controller -> complete', { functionName: 'boot-surface-controller', phase: 'completed', arguments: input });
  }
}
