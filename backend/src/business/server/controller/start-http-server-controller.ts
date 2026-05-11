// @ts-nocheck
/**
 * WHAT: Generated controller function start-http-server-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { readBlueprinttoolState } from '@backend/business/ledger/helper/read-blueprinttool-state.js';
import { watchLedgerDirectory } from '@backend/business/refresh/helper/watch-ledger-directory.js';

export async function startHttpServerController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:start-http-server-controller -> start', { functionName: 'start-http-server-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:start-http-server-controller -> start-http-server-controller-started', { functionName: 'start-http-server-controller', phase: 'event' });
    try {
      await readBlueprinttoolState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'start-http-server-controller', dependencyName: 'read-blueprinttool-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await watchLedgerDirectory({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'start-http-server-controller', dependencyName: 'watch-ledger-directory', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await createHttpServer({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'start-http-server-controller', dependencyName: 'create-http-server', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:start-http-server-controller -> start-http-server-controller-completed', { functionName: 'start-http-server-controller', phase: 'event' });
  } finally {
    telemetry('controller:start-http-server-controller -> complete', { functionName: 'start-http-server-controller', phase: 'completed', arguments: input });
  }
}
