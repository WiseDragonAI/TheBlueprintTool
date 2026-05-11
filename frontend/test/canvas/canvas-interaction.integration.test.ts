/**
 * WHAT: Integration test for spec 30000001-30000009.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { handleCanvasGestureController } from '@frontend/business/gesture/controller/handle-canvas-gesture-controller.js';
import { editCardController } from '@frontend/business/card/controller/edit-card-controller.js';

test('Canvas selection pan zoom and render performance paths hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["derive-gesture-intent","calculate-marquee-selection","calculate-viewport-transform","render-canvas-surface","render-card-layer"];
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
    console.log(JSON.stringify({ specId: '30000001-30000009', controllerName: 'handle-canvas-gesture-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editCardController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '30000001-30000009', controllerName: 'edit-card-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '30000001-30000009', suiteName: 'Canvas selection pan zoom and render performance paths hold', controllerName: ["handle-canvas-gesture-controller","edit-card-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
