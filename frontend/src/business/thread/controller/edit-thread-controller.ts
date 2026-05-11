// @ts-nocheck
/**
 * WHAT: Generated controller function edit-thread-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { commitLedgerEdit } from '@frontend/business/persistence/effect/commit-ledger-edit.js';
import { renderThreadPanel } from '@frontend/business/thread/effect/render-thread-panel.js';
import { resolveThreadTarget } from '@frontend/business/thread/helper/resolve-thread-target.js';

export async function editThreadController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:edit-thread-controller -> start', { functionName: 'edit-thread-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:edit-thread-controller -> edit-thread-controller-started', { functionName: 'edit-thread-controller', phase: 'event' });
    try {
      await resolveThreadTarget({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-thread-controller', dependencyName: 'resolve-thread-target', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-thread-controller -> edit-thread-target-missing', { functionName: 'edit-thread-controller', phase: 'event' });
    try {
      await renderThreadPanel({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-thread-controller', dependencyName: 'render-thread-panel', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await commitLedgerEdit({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-thread-controller', dependencyName: 'commit-ledger-edit', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderThreadPanel({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'edit-thread-controller', dependencyName: 'render-thread-panel', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:edit-thread-controller -> edit-thread-controller-completed', { functionName: 'edit-thread-controller', phase: 'event' });
  } finally {
    telemetry('controller:edit-thread-controller -> complete', { functionName: 'edit-thread-controller', phase: 'completed', arguments: input });
  }
}
