/**
 * WHAT: Integration test for spec ccb07726.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { runReportModeController } from '../../src/business/report/controller/run-report-mode.js';

test('Main integration tests report execution stack traces for success and failure', async () => {
  const expectedTelemetry = ["run-node-test","capture-execution-stack-trace"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('ccb07726'.length, 8);
  traces.length = 0;
  await runReportModeController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"report","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"report","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"report","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: 'ccb07726',
    suiteName: 'Main integration tests report execution stack traces for success and failure',
    controllerName: "run-report-mode",
    executionEntry: "controller:run-report-mode",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
