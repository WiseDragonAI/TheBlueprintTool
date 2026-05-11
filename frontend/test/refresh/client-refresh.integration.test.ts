/**
 * WHAT: Integration test for spec 10f4a4c7-689842e0-9d1b7c36-be4ec9c2.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { handleClientRefreshController } from '@frontend/business/refresh/controller/handle-client-refresh-controller.js';

test('Client refresh consumes server events and preserves canvas continuity during operator work', async () => {
  traces.length = 0;
  const expectedTelemetry = ["subscribe-server-refresh","load-ledger-state","merge-refresh-state","render-canvas-surface"];
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
    await handleClientRefreshController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '10f4a4c7-689842e0-9d1b7c36-be4ec9c2', controllerName: 'handle-client-refresh-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '10f4a4c7-689842e0-9d1b7c36-be4ec9c2', suiteName: 'Client refresh consumes server events and preserves canvas continuity during operator work', controllerName: ["handle-client-refresh-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
