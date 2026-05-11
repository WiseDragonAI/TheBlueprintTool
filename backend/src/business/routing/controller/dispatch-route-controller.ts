// @ts-nocheck
/**
 * WHAT: Generated controller function dispatch-route-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { resolveLedgerRoute } from '@backend/business/routing/helper/resolve-ledger-route.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';

export async function dispatchRouteController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:dispatch-route-controller -> start', { functionName: 'dispatch-route-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:dispatch-route-controller -> dispatch-route-controller-started', { functionName: 'dispatch-route-controller', phase: 'event' });
    try {
      await parseHttpRequest({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'dispatch-route-controller', dependencyName: 'parse-http-request', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveLedgerRoute({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'dispatch-route-controller', dependencyName: 'resolve-ledger-route', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:dispatch-route-controller -> dispatch-route-not-found', { functionName: 'dispatch-route-controller', phase: 'event' });
    try {
      await sendJsonResponse({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'dispatch-route-controller', dependencyName: 'send-json-response', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await readLedgerJsonFile({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'dispatch-route-controller', dependencyName: 'read-ledger-json-file', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await sendJsonResponse({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'dispatch-route-controller', dependencyName: 'send-json-response', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:dispatch-route-controller -> dispatch-route-controller-completed', { functionName: 'dispatch-route-controller', phase: 'event' });
  } finally {
    telemetry('controller:dispatch-route-controller -> complete', { functionName: 'dispatch-route-controller', phase: 'completed', arguments: input });
  }
}
