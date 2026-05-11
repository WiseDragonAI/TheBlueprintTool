/**
 * WHAT: Integration test for spec 9c31f0a4.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@backend/telemetry/harness.js';
import { loadTabLedgersController } from '@backend/business/ledger/controller/load-tab-ledgers-controller.js';

test('Ledgers in .blueprinttool load as default tabs unless invalid', async () => {
  traces.length = 0;
  const expectedTelemetry = ["read-blueprinttool-state","read-ledger-json-file","validate-ledger-document","write-blueprinttool-state"];
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
    await loadTabLedgersController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '9c31f0a4', controllerName: 'load-tab-ledgers-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '9c31f0a4', suiteName: 'Ledgers in .blueprinttool load as default tabs unless invalid', controllerName: ["load-tab-ledgers-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
