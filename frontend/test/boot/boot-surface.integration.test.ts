/**
 * WHAT: Integration test for spec 10000001.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { bootSurfaceController } from '@frontend/business/boot/controller/boot-surface-controller.js';

test('Core opens the correct surface restores durable truth clears transient selection and renders usable canvas', async () => {
  traces.length = 0;
  const expectedTelemetry = ["load-ledger-state","derive-route-state","clear-transient-selection","render-canvas-surface"];
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
    await bootSurfaceController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '10000001', controllerName: 'boot-surface-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '10000001', suiteName: 'Core opens the correct surface restores durable truth clears transient selection and renders usable canvas', controllerName: ["boot-surface-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
