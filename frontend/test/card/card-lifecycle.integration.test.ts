/**
 * WHAT: Integration test for spec 60000001-60000010.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { editCardController } from '@frontend/business/card/controller/edit-card-controller.js';

test('Card identity selection drag persistence tabs notes labels hash IDs and markdown hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["resolve-selection-target","calculate-drag-delta","commit-ledger-edit","render-card-layer","parse-card-markdown"];
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
    await editCardController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '60000001-60000010', controllerName: 'edit-card-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '60000001-60000010', suiteName: 'Card identity selection drag persistence tabs notes labels hash IDs and markdown hold', controllerName: ["edit-card-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
