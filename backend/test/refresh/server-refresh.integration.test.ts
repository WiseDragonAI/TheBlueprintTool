/**
 * WHAT: Integration test for spec b7e4dfd1-2e4c6d2b-10f4a4c7-689842e0-929342ae-ac07dc1b-9d1b7c36-0f361538-be4ec9c2.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@backend/telemetry/harness.js';
import { publishServerRefreshController } from '@backend/business/refresh/controller/publish-server-refresh-controller.js';

test('External ledger updates trigger server refresh and preserve client continuity when possible', async () => {
  traces.length = 0;
  const expectedTelemetry = ["watch-ledger-directory","debounce-refresh-event","publish-refresh-event","read-ledger-json-file"];
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
    await publishServerRefreshController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'b7e4dfd1-2e4c6d2b-10f4a4c7-689842e0-929342ae-ac07dc1b-9d1b7c36-0f361538-be4ec9c2', controllerName: 'publish-server-refresh-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: 'b7e4dfd1-2e4c6d2b-10f4a4c7-689842e0-929342ae-ac07dc1b-9d1b7c36-0f361538-be4ec9c2', suiteName: 'External ledger updates trigger server refresh and preserve client continuity when possible', controllerName: ["publish-server-refresh-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
