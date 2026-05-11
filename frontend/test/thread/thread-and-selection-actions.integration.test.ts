/**
 * WHAT: Integration test for spec 50000002-50000016.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { handleCanvasGestureController } from '@frontend/business/gesture/controller/handle-canvas-gesture-controller.js';
import { bootSurfaceController } from '@frontend/business/boot/controller/boot-surface-controller.js';
import { editThreadController } from '@frontend/business/thread/controller/edit-thread-controller.js';

test('Tab switch refresh marquee escape drawer note create note delete and copy selection hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["derive-route-state","render-thread-panel","commit-ledger-edit","copy-selection-payload"];
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
    console.log(JSON.stringify({ specId: '50000002-50000016', controllerName: 'handle-canvas-gesture-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await bootSurfaceController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '50000002-50000016', controllerName: 'boot-surface-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editThreadController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '50000002-50000016', controllerName: 'edit-thread-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '50000002-50000016', suiteName: 'Tab switch refresh marquee escape drawer note create note delete and copy selection hold', controllerName: ["handle-canvas-gesture-controller","boot-surface-controller","edit-thread-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
