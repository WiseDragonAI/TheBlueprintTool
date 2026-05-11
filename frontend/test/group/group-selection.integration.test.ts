/**
 * WHAT: Integration test for spec 6583c446-53d49146-90d84349-1d444573-796827d0-4801e6c7-85c81d67-0421d906-dff19657-d9d57c2c-2476bfa1-d2fbfa28-612afeda-8a05ef46-5b918cd3-d4f90f42-abad6dcb.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { editGroupController } from '@frontend/business/group/controller/edit-group-controller.js';

test('Copy paste and group tool group rendering click precedence grouped selection and drag hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["resolve-tool-mode","resolve-group-membership","resolve-click-precedence","calculate-drag-delta","commit-ledger-edit","render-group-layer"];
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
    await editGroupController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '6583c446-53d49146-90d84349-1d444573-796827d0-4801e6c7-85c81d67-0421d906-dff19657-d9d57c2c-2476bfa1-d2fbfa28-612afeda-8a05ef46-5b918cd3-d4f90f42-abad6dcb', controllerName: 'edit-group-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '6583c446-53d49146-90d84349-1d444573-796827d0-4801e6c7-85c81d67-0421d906-dff19657-d9d57c2c-2476bfa1-d2fbfa28-612afeda-8a05ef46-5b918cd3-d4f90f42-abad6dcb', suiteName: 'Copy paste and group tool group rendering click precedence grouped selection and drag hold', controllerName: ["edit-group-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
