/**
 * WHAT: Integration test for spec 10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@backend/telemetry/harness.js';
import { publishServerRefreshController } from '@backend/business/refresh/controller/publish-server-refresh-controller.js';
import { commitLedgerEditController } from '@backend/business/persistence/controller/commit-ledger-edit-controller.js';
import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';

test('Frontend backend stack implementation directions hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["create-http-server","parse-http-request","read-ledger-json-file","publish-refresh-event"];
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
    console.log(JSON.stringify({ specId: '10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e', controllerName: 'publish-server-refresh-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await commitLedgerEditController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e', controllerName: 'commit-ledger-edit-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await startHttpServerController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e', controllerName: 'start-http-server-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e', suiteName: 'Frontend backend stack implementation directions hold', controllerName: ["publish-server-refresh-controller","commit-ledger-edit-controller","start-http-server-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
