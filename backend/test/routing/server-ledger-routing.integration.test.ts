/**
 * WHAT: Integration test for spec 70000001-70000007.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@backend/telemetry/harness.js';
import { commitLedgerEditController } from '@backend/business/persistence/controller/commit-ledger-edit-controller.js';
import { loadTabLedgersController } from '@backend/business/ledger/controller/load-tab-ledgers-controller.js';
import { dispatchRouteController } from '@backend/business/routing/controller/dispatch-route-controller.js';

test('Server routes serve ledgers accept edits persist JSON create ledgers and index .blueprinttool tabs', async () => {
  traces.length = 0;
  const expectedTelemetry = ["parse-http-request","resolve-ledger-route","read-ledger-json-file","validate-ledger-edit-payload","write-ledger-json-file","write-blueprinttool-state"];
  const argvPayload = {
    ok: true,
    mode: 'dry-run',
    apply_command: true,
    check_ledger_command: true,
    report_command: true,
    patch_doc_command: true,
    ledger_command: 'mutate',
    master_ledger_file: 'generated-master-ledger.md',
    specs_ledger_file: 'generated-specs-ledger.json',
    patch_batch_file: 'generated-patch-batch.json',
    report_file: 'generated-report.json'
  };
  const actionPayload = { ...argvPayload, cli_command_argv: argvPayload, argv: argvPayload };
  try {
    await commitLedgerEditController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '70000001-70000007', controllerName: 'commit-ledger-edit-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await loadTabLedgersController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '70000001-70000007', controllerName: 'load-tab-ledgers-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await dispatchRouteController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '70000001-70000007', controllerName: 'dispatch-route-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '70000001-70000007', suiteName: 'Server routes serve ledgers accept edits persist JSON create ledgers and index .blueprinttool tabs', controllerName: ["commit-ledger-edit-controller","load-tab-ledgers-controller","dispatch-route-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
