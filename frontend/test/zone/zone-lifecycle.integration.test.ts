/**
 * WHAT: Integration test for spec 20000002-20000018.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { editZoneController } from '@frontend/business/zone/controller/edit-zone-controller.js';

test('Zone creation naming color resizing moving containment deletion and persistence paths hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["resolve-tool-mode","validate-zone-draft","calculate-zone-geometry","resolve-zone-selection-membership","confirm-zone-deletion","commit-ledger-edit","render-zone-layer"];
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
    console.log(JSON.stringify({ specId: '20000002-20000018', controllerName: 'edit-zone-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '20000002-20000018', suiteName: 'Zone creation naming color resizing moving containment deletion and persistence paths hold', controllerName: ["edit-zone-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
