/**
 * WHAT: Integration test for spec 7ec16380.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { traces } from '../../src/telemetry/harness.js';
import { dispatchCliCommandController } from '../../src/business/command/controller/dispatch-cli-command.js';

test('Report mode runs tests gathers telemetry and writes generated report file', async () => {
  const expectedTelemetry = ["parse-cli-argv","run-node-test","write-generated-report-file"];
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('7ec16380'.length, 8);
  traces.length = 0;
  await dispatchCliCommandController({ action_payload: {"apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","mode":"report","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json","argv":{"mode":"report","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"},"cli_command_argv":{"mode":"report","apply_command":true,"check_ledger_command":true,"ledger_command":"mutate","ledger_group_name":[],"ledger_json_file":"ledger.json","master_ledger_file":"master-ledger.md","node_test_run":"node --test","patch_batch_file":"patch.json","report_command":true,"specs_ledger_file":"specs.json"}} } as never);
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({
    specId: '7ec16380',
    suiteName: 'Report mode runs tests gathers telemetry and writes generated report file',
    controllerName: "dispatch-cli-command",
    executionEntry: "controller:dispatch-cli-command",
    expectedTelemetry,
    actualTelemetry,
  }));
  for (const expected of expectedTelemetry) {
    assert.ok(actualTelemetry.some((event) => event.includes(expected)), expected);
  }
});
