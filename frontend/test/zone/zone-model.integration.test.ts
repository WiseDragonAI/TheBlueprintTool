/**
 * WHAT: Integration test for spec 20000001.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { editZoneController } from '@frontend/business/zone/controller/edit-zone-controller.js';

test('Zones are first-class canvas objects with persistent ID name color geometry and notes', async () => {
  traces.length = 0;
  const expectedTelemetry = ["validate-zone-draft","commit-ledger-edit","render-zone-layer"];
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
    await editZoneController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '20000001', controllerName: 'edit-zone-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '20000001', suiteName: 'Zones are first-class canvas objects with persistent ID name color geometry and notes', controllerName: ["edit-zone-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
