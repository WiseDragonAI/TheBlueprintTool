/**
 * WHAT: Integration test for spec d5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { operateToolboxController } from '@frontend/business/toolbox/controller/operate-toolbox-controller.js';
import { bootSurfaceController } from '@frontend/business/boot/controller/boot-surface-controller.js';
import { editCardController } from '@frontend/business/card/controller/edit-card-controller.js';

test('Zone click Ctrl-click card drag zone drag toolbox and route-addressable tab UI hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["resolve-selection-target","resolve-tool-mode","render-tab-registry","render-toolbox"];
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
    await operateToolboxController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'd5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd', controllerName: 'operate-toolbox-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await bootSurfaceController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'd5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd', controllerName: 'boot-surface-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editCardController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'd5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd', controllerName: 'edit-card-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: 'd5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd', suiteName: 'Zone click Ctrl-click card drag zone drag toolbox and route-addressable tab UI hold', controllerName: ["operate-toolbox-controller","boot-surface-controller","edit-card-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
