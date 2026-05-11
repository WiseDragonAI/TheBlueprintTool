// @ts-nocheck
/**
 * WHAT: Generated controller function load-tab-ledgers-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import { readBlueprinttoolState } from '@backend/business/ledger/helper/read-blueprinttool-state.js';
import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';
import { validateLedgerDocument } from '@backend/business/ledger/helper/validate-ledger-document.js';
import { writeBlueprinttoolState } from '@backend/business/ledger/effect/write-blueprinttool-state.js';

export async function loadTabLedgersController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:load-tab-ledgers-controller -> start', { functionName: 'load-tab-ledgers-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:load-tab-ledgers-controller -> load-tab-ledgers-controller-started', { functionName: 'load-tab-ledgers-controller', phase: 'event' });
    try {
      await readBlueprinttoolState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'load-tab-ledgers-controller', dependencyName: 'read-blueprinttool-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await readLedgerJsonFile({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'load-tab-ledgers-controller', dependencyName: 'read-ledger-json-file', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await validateLedgerDocument({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'load-tab-ledgers-controller', dependencyName: 'validate-ledger-document', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:load-tab-ledgers-controller -> load-tab-ledgers-invalid-ledger-rejected', { functionName: 'load-tab-ledgers-controller', phase: 'event' });
    try {
      await writeBlueprinttoolState({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'load-tab-ledgers-controller', dependencyName: 'write-blueprinttool-state', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await sendJsonResponse({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'load-tab-ledgers-controller', dependencyName: 'send-json-response', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:load-tab-ledgers-controller -> load-tab-ledgers-controller-completed', { functionName: 'load-tab-ledgers-controller', phase: 'event' });
  } finally {
    telemetry('controller:load-tab-ledgers-controller -> complete', { functionName: 'load-tab-ledgers-controller', phase: 'completed', arguments: input });
  }
}
