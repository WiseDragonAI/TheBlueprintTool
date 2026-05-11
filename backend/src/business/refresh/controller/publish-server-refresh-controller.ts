// @ts-nocheck
/**
 * WHAT: Generated controller function publish-server-refresh-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import { debounceRefreshEvent } from '@backend/business/refresh/helper/debounce-refresh-event.js';
import { publishRefreshEvent } from '@backend/business/refresh/effect/publish-refresh-event.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { validateLedgerDocument } from '@backend/business/ledger/helper/validate-ledger-document.js';
import { watchLedgerDirectory } from '@backend/business/refresh/helper/watch-ledger-directory.js';

export async function publishServerRefreshController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:publish-server-refresh-controller -> start', { functionName: 'publish-server-refresh-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:publish-server-refresh-controller -> publish-server-refresh-controller-started', { functionName: 'publish-server-refresh-controller', phase: 'event' });
    try {
      await watchLedgerDirectory({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'publish-server-refresh-controller', dependencyName: 'watch-ledger-directory', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await debounceRefreshEvent({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'publish-server-refresh-controller', dependencyName: 'debounce-refresh-event', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:publish-server-refresh-controller -> publish-server-refresh-suppressed', { functionName: 'publish-server-refresh-controller', phase: 'event' });
    try {
      await readLedgerJsonFile({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'publish-server-refresh-controller', dependencyName: 'read-ledger-json-file', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await validateLedgerDocument({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'publish-server-refresh-controller', dependencyName: 'validate-ledger-document', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await publishRefreshEvent({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'publish-server-refresh-controller', dependencyName: 'publish-refresh-event', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:publish-server-refresh-controller -> publish-server-refresh-controller-completed', { functionName: 'publish-server-refresh-controller', phase: 'event' });
  } finally {
    telemetry('controller:publish-server-refresh-controller -> complete', { functionName: 'publish-server-refresh-controller', phase: 'completed', arguments: input });
  }
}
