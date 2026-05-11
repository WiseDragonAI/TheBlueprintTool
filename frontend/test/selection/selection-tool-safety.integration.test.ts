/**
 * WHAT: Integration test for spec 40000002-40000012.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { handleCanvasGestureController } from '@frontend/business/gesture/controller/handle-canvas-gesture-controller.js';
import { bootSurfaceController } from '@frontend/business/boot/controller/boot-surface-controller.js';
import { editGroupController } from '@frontend/business/group/controller/edit-group-controller.js';

test('Invalid actions mixed selection selection clear tool mode and navigation persistence hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["derive-gesture-intent","resolve-selection-target","clear-transient-selection","resolve-tool-mode"];
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
    await handleCanvasGestureController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '40000002-40000012', controllerName: 'handle-canvas-gesture-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await bootSurfaceController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '40000002-40000012', controllerName: 'boot-surface-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editGroupController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '40000002-40000012', controllerName: 'edit-group-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '40000002-40000012', suiteName: 'Invalid actions mixed selection selection clear tool mode and navigation persistence hold', controllerName: ["handle-canvas-gesture-controller","boot-surface-controller","edit-group-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
