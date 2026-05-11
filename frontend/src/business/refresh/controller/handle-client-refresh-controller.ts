// @ts-nocheck
/**
 * WHAT: Generated controller function handle-client-refresh-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { loadLedgerState } from '@frontend/business/boot/helper/load-ledger-state.js';
import { mergeRefreshState } from '@frontend/business/refresh/helper/merge-refresh-state.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { subscribeServerRefresh } from '@frontend/business/refresh/effect/subscribe-server-refresh.js';

export async function handleClientRefreshController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:handle-client-refresh-controller -> start', { functionName: 'handle-client-refresh-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:handle-client-refresh-controller -> handle-client-refresh-controller-started', { functionName: 'handle-client-refresh-controller', phase: 'event' });
    try {
      await subscribeServerRefresh({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-client-refresh-controller', dependencyName: 'subscribe-server-refresh', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await loadLedgerState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-client-refresh-controller', dependencyName: 'load-ledger-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await mergeRefreshState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-client-refresh-controller', dependencyName: 'merge-refresh-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:handle-client-refresh-controller -> handle-client-refresh-full-reload-required', { functionName: 'handle-client-refresh-controller', phase: 'event' });
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'handle-client-refresh-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:handle-client-refresh-controller -> handle-client-refresh-controller-completed', { functionName: 'handle-client-refresh-controller', phase: 'event' });
  } finally {
    telemetry('controller:handle-client-refresh-controller -> complete', { functionName: 'handle-client-refresh-controller', phase: 'completed', arguments: input });
  }
}
